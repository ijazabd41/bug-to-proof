import { Router, Request, Response, NextFunction } from "express";
import type { Evidence, TestRun, VerificationComparison } from "@bug-to-proof/shared-types";
import { readCase, writeCase } from "../storage/caseStore";
import { runTest } from "../runner/playwrightRunner";

export const verifyRouter = Router();

verifyRouter.post("/:id/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const bugCase = readCase(id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (bugCase.status !== "PATCH_APPLIED") {
      res.status(409).json({
        error: "Invalid state for verification",
        details: `Case must be in PATCH_APPLIED state to verify. Current state: ${bugCase.status}`,
      });
      return;
    }

    if (!bugCase.reproduction?.testFile) {
      res.status(400).json({
        error: "Case has no testFile defined in reproduction",
      });
      return;
    }

    // ── Set status → VERIFYING immediately ────────────────────────────────
    bugCase.status = "VERIFYING";
    bugCase.updatedAt = new Date().toISOString();
    writeCase(bugCase);

    // ── Return 202 immediately ─────────────────────────────────────────────
    res.status(202).json({ message: "Verification started", caseId: id });

    // ── Run Playwright asynchronously ──────────────────────────────────────
    runTest(id, bugCase.reproduction.testFile, "after")
      .then((result) => {
        const fresh = readCase(id);
        if (!fresh) return;

        const now = new Date().toISOString();

        // Build evidence items
        const newEvidence: Evidence[] = [];

        if (result.artifactPaths.screenshot) {
          newEvidence.push({
            id: `ev-${id}-after-screenshot`,
            type: "screenshot",
            phase: "after",
            path: result.artifactPaths.screenshot,
            createdAt: now,
            description: "Screenshot captured after patch",
          });
        }

        if (result.artifactPaths.trace) {
          newEvidence.push({
            id: `ev-${id}-after-trace`,
            type: "trace",
            phase: "after",
            path: result.artifactPaths.trace,
            createdAt: now,
            description: "Playwright trace after patch",
          });
        }

        if (result.artifactPaths.resultJson) {
          newEvidence.push({
            id: `ev-${id}-after-result`,
            type: "result-json",
            phase: "after",
            path: result.artifactPaths.resultJson,
            createdAt: now,
            description: "Raw Playwright JSON result after patch",
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
          runAt: now,
          passed: result.passed,
          expected: fresh.reproduction?.expected ?? result.expected,
          actual: result.actual,
          durationMs: result.durationMs,
          evidenceIds: newEvidence.map((e) => e.id),
        };

        // Update verification
        const verification = fresh.verification ?? {
          status: "PENDING",
          beforeRun: null,
          afterRun: null,
          comparison: null,
        };

        verification.afterRun = testRun;

        const beforePassed = verification.beforeRun?.passed ?? null;
        const comparison: VerificationComparison = {
          statusChanged: beforePassed !== result.passed,
          beforeStatus: beforePassed === null ? null : beforePassed ? "PASSED" : "FAILED",
          afterStatus: result.passed ? "PASSED" : "FAILED",
        };
        verification.comparison = comparison;

        if (result.passed) {
          fresh.status = "VERIFIED";
          verification.status = "VERIFIED";
        } else {
          fresh.status = "VERIFICATION_FAILED";
          verification.status = "VERIFICATION_FAILED";
        }

        fresh.verification = verification;
        fresh.updatedAt = new Date().toISOString();
        writeCase(fresh);
        console.log(`[runner] Verification for ${id}: ${fresh.status}`);
      })
      .catch((err: unknown) => {
        console.error(`[runner] Verify async error for ${id}:`, err);
        const fresh = readCase(id);
        if (fresh && fresh.status === "VERIFYING") {
          fresh.status = "VERIFICATION_FAILED";
          if (fresh.verification) {
            fresh.verification.status = "VERIFICATION_FAILED";
          }
          fresh.updatedAt = new Date().toISOString();
          writeCase(fresh);
        }
      });
  } catch (err) {
    next(err);
  }
});
