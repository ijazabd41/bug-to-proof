import { Router, Request, Response, NextFunction } from "express";
import type { BugCase, Reproduction, Patch } from "@bug-to-proof/shared-types";
import {
  readAllCases,
  readCase,
  writeCase,
  deleteCase,
  CorruptCaseRecordError,
} from "../storage/caseStore";
import { listRunRecords } from "../ai/repair/runStore";
import { isActiveRepairState } from "../ai/repair/contracts";
import { callLLM } from "../llm/client";
import { rimrafDir } from "../utils/rimraf";
import { ARTIFACTS_DIR } from "../utils/paths";
import path from "path";
import { validBaseline } from "../runner/integrity";
import {
  validateCaseId,
  validateCreateCase,
  validatePatchCase,
  generateCollisionResistantCaseId,
  sanitizeLLMReproduction,
} from "../validation/caseValidation";
import { assessReportCompleteness } from "../reproduction/reportCompleteness";

export const casesRouter = Router();

function hasActiveDynamicRepairRun(caseId: string): boolean {
  const runs = listRunRecords(caseId);
  return runs.some((r) => isActiveRepairState(r.state) && !r.completedAt);
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

casesRouter.get("/", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cases = readAllCases();
    res.json(cases);
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message, retryable: false });
      return;
    }
    next(err);
  }
});

// ── POST /api/cases ───────────────────────────────────────────────────────────

casesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validateCreateCase(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({
        error: validation.error || "Invalid request body",
        details: validation.details,
      });
      return;
    }

    const { title, description, steps, expected, actual, startPath, context } = validation.data;
    const id = generateCollisionResistantCaseId();
    const now = new Date().toISOString();

    // Default reproduction — will be enriched by LLM Call 1 async
    const reproduction: Reproduction = {
      preconditions: [],
      steps: [description],
      expected: "",
      actual: "",
      testFile: "",
      lastRun: null,
    };

    const bugCase: BugCase = {
      id,
      title,
      description,
      report: { schemaVersion: "1.0", steps, expected, actual, startPath, context },
      reportCompleteness: assessReportCompleteness({ schemaVersion: "1.0", steps, expected, actual, startPath, context }),
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
    const initialUpdatedAt = now;
    callLLM(
      `You are a software QA engineer. Given the following bug description, extract:
- preconditions (array of strings)
- steps (array of numbered steps to reproduce)
- expected (single sentence: what should happen)
- actual (single sentence: what actually happens)

Return JSON only, no prose.

Bug description: "${description}"`
    )
      .then((llmResponse) => {
        if (!llmResponse) return;
        try {
          const parsed = JSON.parse(llmResponse);
          const current = readCase(id);
          if (!current || !current.reproduction) return;
          // Guard against overwriting newer user edits
          if (current.updatedAt !== initialUpdatedAt || current.status !== "REPORTED") {
            console.log(`[llm] Case ${id} was modified concurrently; discarding LLM Call 1 structuring`);
            return;
          }

          const sanitized = sanitizeLLMReproduction(parsed, current.reproduction);
          current.reproduction = {
            ...current.reproduction,
            ...sanitized,
          };
          current.updatedAt = new Date().toISOString();
          writeCase(current);
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

casesRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!validateCaseId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  try {
    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    res.json(bugCase);
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
      return;
    }
    next(err);
  }
});

// ── PATCH /api/cases/:id ──────────────────────────────────────────────────────

casesRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!validateCaseId(id)) {
      res.status(400).json({ error: "Invalid case ID format" });
      return;
    }

    let bugCase: BugCase | null;
    try {
      bugCase = readCase(id);
    } catch (err) {
      if (err instanceof CorruptCaseRecordError) {
        res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
        return;
      }
      throw err;
    }

    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const validation = validatePatchCase(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({
        error: validation.error || "Invalid request body",
        details: validation.details,
      });
      return;
    }

    if (["REPRODUCING", "VERIFYING"].includes(bugCase.status) || hasActiveDynamicRepairRun(id)) {
      res.status(409).json({ error: "Cannot edit a case while an active dynamic repair run or evidence run is in progress" });
      return;
    }

    const body = validation.data;

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

    if ((body.status === "PATCH_PROPOSED" || body.status === "PATCH_APPLIED") && !validBaseline(bugCase)) {
      res.status(409).json({ error: "Reproduce a recorded assertion failure before proposing or applying a patch" });
      return;
    }

    if (
      body.reproduction &&
      ["testFile", "expected", "steps", "preconditions"].some(
        (key) =>
          key in body.reproduction! &&
          JSON.stringify((body.reproduction as any)[key]) !== JSON.stringify((bugCase.reproduction as any)?.[key])
      )
    ) {
      bugCase.verification = null;
      if (bugCase.reproduction) bugCase.reproduction.lastRun = null;
      bugCase.status = "READY_TO_REPRODUCE";
      delete body.status;
    }

    const hasPatchDiff = body.patch?.diff && !bugCase.patch?.diff;

    // ── Merge allowed validated fields ────────────────────────────────────
    if (body.title) bugCase.title = body.title;
    if (body.description) bugCase.description = body.description;
    if (body.report) {
      bugCase.report = body.report;
      bugCase.reportCompleteness = assessReportCompleteness(body.report);
    }
    if (body.status) bugCase.status = body.status;
    if (body.reproduction) {
      bugCase.reproduction = {
        ...(bugCase.reproduction || {
          preconditions: [],
          steps: [],
          expected: "",
          actual: "",
          testFile: "",
          lastRun: null,
        }),
        ...body.reproduction,
      };
    }
    if (body.patch) {
      bugCase.patch = bugCase.patch
        ? { ...bugCase.patch, ...body.patch }
        : (body.patch as Patch);
    }

    const patchUpdatedAt = new Date().toISOString();
    bugCase.updatedAt = patchUpdatedAt;
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
              summary?: unknown;
              reasoning?: unknown;
            };
            const updated = readCase(id);
            if (!updated?.patch) return;
            // Guard against overwriting newer edits
            if (updated.updatedAt !== patchUpdatedAt) {
              console.log(`[llm] Case ${id} was modified concurrently; discarding LLM Call 2 summary`);
              return;
            }

            if (typeof parsed.summary === "string" && parsed.summary.trim() !== "") {
              updated.patch.summary = parsed.summary.trim().slice(0, 500);
            }
            if (typeof parsed.reasoning === "string" && parsed.reasoning.trim() !== "") {
              updated.patch.reasoning = parsed.reasoning.trim().slice(0, 2000);
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

casesRouter.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!validateCaseId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }

  let bugCase: BugCase | null;
  try {
    bugCase = readCase(id);
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
      return;
    }
    next(err);
    return;
  }

  if (!bugCase) {
    res.status(404).json({ error: "Case not found", reason: "initial_read" });
    return;
  }

  if (["REPRODUCING", "VERIFYING"].includes(bugCase.status) || hasActiveDynamicRepairRun(id)) {
    res.status(409).json({ error: "Cannot delete a case while an active dynamic repair run or evidence run is in progress" });
    return;
  }

  const deleted = deleteCase(id);
  if (!deleted) {
    res.status(404).json({ error: "Case not found", reason: "delete_failed" });
    return;
  }

  // Remove artifacts directory if it exists
  rimrafDir(path.join(ARTIFACTS_DIR, id));

  res.status(204).send();
});

// ── GET /api/cases/:id/reproduction ──────────────────────────────────────────

casesRouter.get("/:id/reproduction", (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!validateCaseId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  try {
    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    const beforeEvidence = bugCase.evidence.filter((e) => e.phase === "before");
    res.json({ reproduction: bugCase.reproduction, evidence: beforeEvidence });
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
      return;
    }
    next(err);
  }
});

// ── GET /api/cases/:id/evidence ───────────────────────────────────────────────

casesRouter.get("/:id/evidence", (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!validateCaseId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  try {
    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    res.json(bugCase.evidence);
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
      return;
    }
    next(err);
  }
});

// ── GET /api/cases/:id/verification ──────────────────────────────────────────

casesRouter.get("/:id/verification", (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!validateCaseId(id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  try {
    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    const afterEvidence = bugCase.evidence.filter((e) => e.phase === "after");
    res.json({ verification: bugCase.verification, evidence: afterEvidence });
  } catch (err) {
    if (err instanceof CorruptCaseRecordError) {
      res.status(500).json({ error: "Corrupt case record on disk", details: err.message });
      return;
    }
    next(err);
  }
});
