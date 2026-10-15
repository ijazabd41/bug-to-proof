import { Router, Request, Response, NextFunction } from "express";
import type { Evidence, TestRun } from "@bug-to-proof/shared-types";
import { readCase, writeCase } from "../storage/caseStore";
import { runTest } from "../runner/playwrightRunner";
import { callLLM } from "../llm/client";

export const reproduceRouter = Router();

reproduceRouter.post("/:id/reproduce", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (!bugCase.reproduction?.testFile) {
      res.status(400).json({
        error: "Case has no trusted reproduction test",
        code: "REPRODUCTION_TEST_REQUIRED",
        details: "Automatic reproduction generation is not available yet; configure reproduction.testFile to use the existing workflow",
      });
      return;
    }

    if (bugCase.status === "REPRODUCING" || bugCase.status === "VERIFYING") {
      res.status(409).json({
        error: "Run already in progress",
        details: `Case is currently in state: ${bugCase.status}`,
      });
      return;
    }

    // ── Set status → REPRODUCING immediately ─────────────────────────────
    bugCase.status = "REPRODUCING";
    bugCase.updatedAt = new Date().toISOString();
    writeCase(bugCase);

    // ── Return 202 immediately ─────────────────────────────────────────────
    res.status(202).json({ message: "Reproduction started", caseId: id });

    // ── Run Playwright asynchronously ──────────────────────────────────────
    runTest(id, bugCase.reproduction.testFile, "before", bugCase.reproduction.testRoot ? { generatedTestRoot: bugCase.reproduction.testRoot } : undefined)
      .then(async (result) => {
        const fresh = readCase(id);
        if (!fresh) return;

        const now = new Date().toISOString();

        // Build evidence items
        const newEvidence: Evidence[] = [];

        if (result.artifactPaths.screenshot) {
          newEvidence.push({
            id: `ev-${id}-${result.runId}-before-screenshot`,
            type: "screenshot",
            phase: "before",
            path: result.artifactPaths.screenshot,
            createdAt: now,
            description: "Screenshot captured before patch",
          });
        }

        if (result.artifactPaths.trace) {
          newEvidence.push({
            id: `ev-${id}-${result.runId}-before-trace`,
            type: "trace",
            phase: "before",
            path: result.artifactPaths.trace,
            createdAt: now,
            description: "Playwright trace before patch",
          });
        }

        if (result.artifactPaths.resultJson) {
          newEvidence.push({
            id: `ev-${id}-${result.runId}-before-result`,
            type: "result-json",
            phase: "before",
            path: result.artifactPaths.resultJson,
            createdAt: now,
            description: "Raw Playwright JSON result before patch",
          });
        }

        // Merge new evidence (avoid duplicates by ID)
        const existingIds = new Set(fresh.evidence.map((e) => e.id));
        for (const ev of newEvidence) {
          if (!existingIds.has(ev.id)) {
            fresh.evidence.push(ev);
          }
        }

        const testRun: TestRun = {
          outcome: result.outcome,
          testFingerprint: result.testFingerprint,
          testIds: result.testIds,
          runId: result.runId,
          reportHash: result.reportHash,
          runAt: now,
          passed: result.passed,
          expected: fresh.reproduction?.expected ?? result.expected,
          actual: result.actual,
          durationMs: result.durationMs,
          evidenceIds: newEvidence.map((e) => e.id),
        };

        if (fresh.reproduction) {
          fresh.reproduction.lastRun = testRun;
        }

        // Verification beforeRun
        fresh.verification = fresh.verification ?? {
          status: "PENDING",
          beforeRun: null,
          afterRun: null,
          comparison: null,
        };
        fresh.verification.beforeRun = testRun; fresh.verification.afterRun = null; fresh.verification.comparison = null; fresh.verification.status = "PENDING";

        // Status transition
        if (result.outcome === "ASSERTION_FAILED") {
          fresh.status = "REPRODUCED";
        } else {
          fresh.status = "REPRODUCTION_FAILED";
        }

        fresh.updatedAt = new Date().toISOString();
        writeCase(fresh);
        console.log(`[runner] Reproduction for ${id}: ${fresh.status}`);

        // ── LLM Call 3 — Root Cause Explanation ─────────────────────────
        if (fresh.status === "REPRODUCED") {
          callLLM(
            `You are a software engineer. A Playwright test has confirmed the following bug.
Write a single paragraph (3-4 sentences) explaining the probable root cause
and its impact on the user experience. Be specific and technical.

Bug title: "${fresh.title}"
Bug description: "${fresh.description}"
Reproduction expected: "${fresh.reproduction?.expected ?? ""}"
Reproduction actual: "${fresh.reproduction?.actual ?? result.actual}"`
          )
            .then((llmResponse) => {
              if (!llmResponse) return;
              const updated = readCase(id);
              if (!updated) return;
              updated.rootCauseExplanation = llmResponse;
              updated.updatedAt = new Date().toISOString();
              writeCase(updated);
              console.log(`[llm] LLM Call 3 updated rootCauseExplanation for ${id}`);
            })
            .catch((err: unknown) => {
              console.warn("[llm] LLM Call 3 error:", err);
            });
        }
      })
      .catch((err: unknown) => {
        console.error(`[runner] Reproduce async error for ${id}:`, err);
        const fresh = readCase(id);
        if (fresh && fresh.status === "REPRODUCING") {
          fresh.status = "REPRODUCTION_FAILED";
          fresh.updatedAt = new Date().toISOString();
          writeCase(fresh);
        }
      });
  } catch (err) {
    next(err);
  }
});
