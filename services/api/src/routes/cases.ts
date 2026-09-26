import { Router, Request, Response, NextFunction } from "express";
import type { BugCase, Reproduction } from "@bug-to-proof/shared-types";
import {
  readAllCases,
  readCase,
  writeCase,
  deleteCase,
} from "../storage/caseStore";
import { callLLM } from "../llm/client";
import { rimrafDir } from "../utils/rimraf";
import { ARTIFACTS_DIR } from "../utils/paths";
import path from "path";

export const casesRouter = Router();

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_ID = /^[a-zA-Z0-9-]{1,50}$/;

function validateId(id: string): boolean {
  return VALID_ID.test(id);
}

/** Valid external status transitions (set via PATCH by dashboard/Bob). */
const ALLOWED_EXTERNAL_TRANSITIONS: Record<string, string[]> = {
  REPORTED: ["READY_TO_REPRODUCE"],
  READY_TO_REPRODUCE: ["REPORTED"],
  REPRODUCED: ["PATCH_PROPOSED"],
  PATCH_PROPOSED: ["PATCH_APPLIED", "REPRODUCED"],
  PATCH_APPLIED: ["PATCH_PROPOSED"],
};

// ── GET /api/cases ────────────────────────────────────────────────────────────

casesRouter.get("/", (_req: Request, res: Response) => {
  const cases = readAllCases();
  res.json(cases);
});

// ── POST /api/cases ───────────────────────────────────────────────────────────

casesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description } = req.body as {
      title?: string;
      description?: string;
    };

    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (!description || typeof description !== "string" || description.trim() === "") {
      res.status(400).json({ error: "description is required" });
      return;
    }

    const id = `case-${Date.now()}`;
    const now = new Date().toISOString();

    // Default reproduction — will be enriched by LLM Call 1 async
    const reproduction: Reproduction = {
      preconditions: [],
      steps: [description.trim()],
      expected: "",
      actual: "",
      testFile: "",
      lastRun: null,
    };

    const bugCase: BugCase = {
      id,
      title: title.trim(),
      description: description.trim(),
      status: "REPORTED",
      createdAt: now,
      updatedAt: now,
      reproduction,
      patch: null,
      verification: null,
      evidence: [],
      rootCauseExplanation: null,
    };

    writeCase(bugCase);
    res.status(201).json(bugCase);

    // ── LLM Call 1 — Bug Report Structuring (async, non-blocking) ──────────
    callLLM(
      `You are a software QA engineer. Given the following bug description, extract:
- preconditions (array of strings)
- steps (array of numbered steps to reproduce)
- expected (single sentence: what should happen)
- actual (single sentence: what actually happens)

Return JSON only, no prose.

Bug description: "${description.trim()}"`
    )
      .then((llmResponse) => {
        if (!llmResponse) return;
        try {
          const parsed = JSON.parse(llmResponse) as Partial<Reproduction>;
          const updated = readCase(id);
          if (!updated) return;
          updated.reproduction = {
            ...updated.reproduction!,
            preconditions: Array.isArray(parsed.preconditions)
              ? parsed.preconditions
              : updated.reproduction!.preconditions,
            steps: Array.isArray(parsed.steps)
              ? parsed.steps
              : updated.reproduction!.steps,
            expected: typeof parsed.expected === "string"
              ? parsed.expected
              : updated.reproduction!.expected,
            actual: typeof parsed.actual === "string"
              ? parsed.actual
              : updated.reproduction!.actual,
          };
          updated.updatedAt = new Date().toISOString();
          writeCase(updated);
          console.log(`[llm] LLM Call 1 updated reproduction for ${id}`);
        } catch {
          console.warn("[llm] LLM Call 1 parse failed — keeping defaults");
        }
      })
      .catch((err: unknown) => {
        console.warn("[llm] LLM Call 1 error:", err);
      });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/cases/:id ────────────────────────────────────────────────────────

casesRouter.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!validateId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(bugCase);
});

// ── PATCH /api/cases/:id ──────────────────────────────────────────────────────

casesRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!validateId(id)) {
      res.status(400).json({ error: "Invalid case ID format" });
      return;
    }

    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const body = req.body as Partial<BugCase>;

    // ── Status transition validation ──────────────────────────────────────
    if (body.status && body.status !== bugCase.status) {
      const allowed = ALLOWED_EXTERNAL_TRANSITIONS[bugCase.status] ?? [];
      if (!allowed.includes(body.status)) {
        res.status(409).json({
          error: `Invalid status transition`,
          details: `Cannot move from ${bugCase.status} to ${body.status}. Allowed: ${allowed.join(", ") || "none"}`,
        });
        return;
      }
    }

    const hasPatchDiff = body.patch?.diff && !bugCase.patch?.diff;

    // ── Merge allowed fields ──────────────────────────────────────────────
    if (body.status) bugCase.status = body.status;
    if (body.reproduction) bugCase.reproduction = { ...bugCase.reproduction, ...body.reproduction } as Reproduction;
    if (body.patch) {
      bugCase.patch = bugCase.patch
        ? { ...bugCase.patch, ...body.patch }
        : body.patch;
    }
    bugCase.updatedAt = new Date().toISOString();
    writeCase(bugCase);
    res.json(bugCase);

    // ── LLM Call 2 — Patch Summary (async, non-blocking) ─────────────────
    if (hasPatchDiff && bugCase.patch?.diff) {
      const patchDiff = bugCase.patch.diff;
      callLLM(
        `You are a software engineer explaining a bug fix to a technical audience.
Given the bug description and the unified diff below, write:
- summary: one sentence describing what was changed (max 120 characters)
- reasoning: 2-3 sentences explaining why this diff fixes the bug

Return JSON only: { "summary": "...", "reasoning": "..." }

Bug description: "${bugCase.description}"

Diff:
${patchDiff}`
      )
        .then((llmResponse) => {
          if (!llmResponse) return;
          try {
            const parsed = JSON.parse(llmResponse) as {
              summary?: string;
              reasoning?: string;
            };
            const updated = readCase(id);
            if (!updated?.patch) return;
            if (typeof parsed.summary === "string") {
              updated.patch.summary = parsed.summary;
            }
            if (typeof parsed.reasoning === "string") {
              updated.patch.reasoning = parsed.reasoning;
            }
            updated.updatedAt = new Date().toISOString();
            writeCase(updated);
            console.log(`[llm] LLM Call 2 updated patch summary for ${id}`);
          } catch {
            console.warn("[llm] LLM Call 2 parse failed — keeping provided summary");
          }
        })
        .catch((err: unknown) => {
          console.warn("[llm] LLM Call 2 error:", err);
        });
    }
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/cases/:id ─────────────────────────────────────────────────────

casesRouter.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!validateId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }

  const deleted = deleteCase(id);
  if (!deleted) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  // Remove artifacts directory if it exists
  rimrafDir(path.join(ARTIFACTS_DIR, id));

  res.status(204).send();
});

// ── GET /api/cases/:id/reproduction ──────────────────────────────────────────

casesRouter.get("/:id/reproduction", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!validateId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const beforeEvidence = bugCase.evidence.filter((e) => e.phase === "before");
  res.json({ reproduction: bugCase.reproduction, evidence: beforeEvidence });
});

// ── GET /api/cases/:id/evidence ───────────────────────────────────────────────

casesRouter.get("/:id/evidence", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!validateId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(bugCase.evidence);
});

// ── GET /api/cases/:id/verification ──────────────────────────────────────────

casesRouter.get("/:id/verification", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!validateId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const afterEvidence = bugCase.evidence.filter((e) => e.phase === "after");
  res.json({ verification: bugCase.verification, evidence: afterEvidence });
});
