import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import {
  createAndStartRepairRun,
  reviewAndApplyRepairRun,
  cancelRepairRun,
  RepairDependencies,
} from "./repairService";
import { computeProposalHash } from "./contracts";
import { writeCase, deleteCase } from "../../storage/caseStore";
import type { BugCase } from "@bug-to-proof/shared-types";
import { ARTIFACTS_DIR } from "../../utils/paths";
import type { RunResult } from "../../runner/playwrightRunner";
import type { RequiredCheckResult } from "./contracts";

import { testFingerprint } from "../../runner/integrity";

const defaultTestFile = "tests/playwright/cases/case-001-cart-total.spec.ts";

const createMockRunResult = (
  outcome: RunResult["outcome"],
  _caseId = "case-test-dynamic-service",
  fingerprint?: string
): RunResult => ({
  passed: outcome === "PASSED",
  outcome,
  expected: "Cart total displays $30.00",
  actual: outcome === "PASSED" ? "Cart total displays $30.00" : "Cart total displays $10.00",
  durationMs: 120,
  runId: "mock-run-id",
  testFingerprint: fingerprint || testFingerprint(defaultTestFile),
  testIds: [`${defaultTestFile}:cart total displays $30.00:chromium`],
  reportHash: "mock-report-hash-12345",
  artifactPaths: {},
  rawOutput: "",
});

const createMockChecks = (allPassed = true): RequiredCheckResult[] => [
  {
    checkId: "check-typecheck",
    name: "TypeScript compilation",
    type: "typecheck",
    command: "tsc --noEmit",
    passed: allPassed,
    exitCode: allPassed ? 0 : 1,
    durationMs: 400,
    output: allPassed ? "Found 0 errors" : "Type error",
  },
  {
    checkId: "check-build",
    name: "Production Vite build",
    type: "build",
    command: "vite build",
    passed: allPassed,
    exitCode: allPassed ? 0 : 1,
    durationMs: 600,
    output: allPassed ? "built in 0.5s" : "Build error",
  },
  {
    checkId: "check-unit-tests",
    name: "MiniShop unit tests",
    type: "unit-tests",
    command: "vitest run apps/minishop",
    passed: allPassed,
    exitCode: allPassed ? 0 : 1,
    durationMs: 300,
    output: allPassed ? "3 passed" : "1 failed",
  },
];

describe("Dynamic AI Repair Service Lifecycle", () => {
  let testCaseId: string;
  let createdRunId: string | null = null;

  beforeEach(() => {
    createdRunId = null;
    testCaseId = `case-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const testCase: BugCase = {
      id: testCaseId,
      title: "Cart reset bug",
      description: "Cart reset function requires explicit comment",
      status: "READY_TO_REPRODUCE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reproduction: {
        preconditions: [],
        steps: ["Add items to cart", "Check reset"],
        expected: "Reset with comment",
        actual: "Reset without comment",
        testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        lastRun: null,
      },
      patch: null,
      verification: null,
      evidence: [],
      rootCauseExplanation: null,
    };
    writeCase(testCase);
  });

  afterEach(async () => {
    if (createdRunId) {
      try {
        await cancelRepairRun(createdRunId);
      } catch {
        // ignore
      }
      const runDir = path.join(ARTIFACTS_DIR, "runs", createdRunId);
      if (fs.existsSync(runDir)) {
        try {
          fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
        } catch {
          // ignore cleanup lock on Windows
        }
      }
    }
    try {
      deleteCase(testCaseId);
    } catch {
      // ignore
    }
  });

  it("handles non-existent or invalid cases gracefully", async () => {
    await expect(createAndStartRepairRun("non-existent-case")).rejects.toThrow("Case not found");
  });

  it("stops at a passing baseline or infrastructure error baseline without proposing patch", async () => {
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {},
      run: async () => createMockRunResult("PASSED"),
    };

    const run = await createAndStartRepairRun(
      testCaseId,
      { mode: "simulated" },
      mockDeps
    );
    createdRunId = run.runId;

    expect(run.state).toBe("BLOCKED");
    expect(run.stopReason).toContain("not reproduced");
    expect(run.proposal).toBeUndefined();
  }, 30_000);

  it("completes full dynamic repair cycle with simulated proposal, exact review binding, and verified checks", async () => {
    let callCount = 0;
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {},
      run: async (_caseId, _file, phase) => {
        callCount++;
        return phase === "before"
          ? createMockRunResult("ASSERTION_FAILED")
          : createMockRunResult("PASSED");
      },
      checks: async () => createMockChecks(true),
    };

    // Phase 1: Create and start run
    const run = await createAndStartRepairRun(
      testCaseId,
      {
        mode: "simulated",
        simulatedProposal: {
          diagnosis: "Cart reset needs descriptive comment",
          assumptions: ["Items array is reset"],
          rationale: "Add descriptive comment to clearCart",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // reset items",
            },
          ],
        },
      },
      mockDeps
    );

    createdRunId = run.runId;
    expect(run.state).toBe("AWAITING_REVIEW");
    expect(run.proposal).toBeDefined();
    expect(run.proposal?.proposalHash).toHaveLength(64);

    // Verify tampered proposal hash is rejected
    await expect(
      reviewAndApplyRepairRun(
        run.runId,
        {
          proposalId: run.proposal!.proposalId,
          proposalHash: "tampered-proposal-hash-0000000000000000000000000000000000000000",
          decision: "APPROVED",
        },
        mockDeps
      )
    ).rejects.toThrow("Exact approval binding failed");

    // Phase 2: Approve with exact proposal ID and hash
    const verifiedRun = await reviewAndApplyRepairRun(
      run.runId,
      {
        proposalId: run.proposal!.proposalId,
        proposalHash: run.proposal!.proposalHash,
        decision: "APPROVED",
      },
      mockDeps
    );

    expect(verifiedRun.state).toBe("VERIFIED");
    expect(verifiedRun.review?.decision).toBe("APPROVED");
    expect(verifiedRun.requiredChecks.length).toBe(3);
    expect(verifiedRun.requiredChecks.every((c) => c.passed)).toBe(true);
  }, 30_000);

  it("marks VERIFICATION_FAILED when regression checks fail and maxAttempts is 1", async () => {
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {},
      run: async (_caseId, _file, phase) => {
        return phase === "before"
          ? createMockRunResult("ASSERTION_FAILED")
          : createMockRunResult("PASSED");
      },
      checks: async () => createMockChecks(false), // Regression failure
    };

    const run = await createAndStartRepairRun(
      testCaseId,
      {
        mode: "simulated",
        maxAttempts: 1,
        simulatedProposal: {
          diagnosis: "Cart reset needs descriptive comment",
          assumptions: ["Items array is reset"],
          rationale: "Add descriptive comment to clearCart",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // reset items",
            },
          ],
        },
      },
      mockDeps
    );

    createdRunId = run.runId;

    const failedRun = await reviewAndApplyRepairRun(
      run.runId,
      {
        proposalId: run.proposal!.proposalId,
        proposalHash: run.proposal!.proposalHash,
        decision: "APPROVED",
      },
      mockDeps
    );

    expect(failedRun.state).toBe("VERIFICATION_FAILED");
    expect(failedRun.attempts?.length).toBe(1);
    expect(failedRun.attempts?.[0].failureReason).toContain("Required regression checks failed");
  }, 30_000);

  it("retries candidate generation with diagnostics when attempt 1 fails and verifies on attempt 2", async () => {
    let checkCallCount = 0;
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {},
      run: async (_caseId, _file, phase) => {
        return phase === "before"
          ? createMockRunResult("ASSERTION_FAILED")
          : createMockRunResult("PASSED");
      },
      checks: async () => {
        checkCallCount++;
        // Attempt 1 checks fail; Attempt 2 checks pass
        return createMockChecks(checkCallCount > 1);
      },
      generate: async (input) => {
        const isAttempt2 = (input.attempt ?? 1) > 1;
        const edits = [
          {
            relativePath: "src/store/cartStore.ts",
            oldContent: "  clearCart: () => set({ items: [] }),",
            newContent: isAttempt2
              ? "  clearCart: () => set({ items: [] }), // attempt 2 fix"
              : "  clearCart: () => set({ items: [] }), // attempt 1 fix",
          },
        ];
        const diagnosis = isAttempt2 ? "Refined diagnosis based on feedback" : "Initial diagnosis";
        const rationale = isAttempt2 ? "Fixed regression" : "Initial patch";
        const hash = computeProposalHash(edits, diagnosis, rationale);
        return {
          schemaVersion: "1.0",
          proposalId: `prop-attempt-${input.attempt ?? 1}`,
          diagnosis,
          assumptions: [],
          rationale,
          edits,
          unifiedDiff: "--- diff",
          proposalHash: hash,
          proposedAt: new Date().toISOString(),
        };
      },
    };

    const run = await createAndStartRepairRun(
      testCaseId,
      {
        mode: "simulated",
        maxAttempts: 3,
      },
      mockDeps
    );

    createdRunId = run.runId;
    expect(run.state).toBe("AWAITING_REVIEW");
    expect(run.attempt).toBe(1);
    expect(run.proposal?.proposalId).toBe("prop-attempt-1");

    // Approve Attempt 1 (which fails regression checks)
    const retryRun = await reviewAndApplyRepairRun(
      run.runId,
      {
        proposalId: run.proposal!.proposalId,
        proposalHash: run.proposal!.proposalHash,
        decision: "APPROVED",
      },
      mockDeps
    );

    // Should transition to AWAITING_REVIEW for Attempt 2
    expect(retryRun.state).toBe("AWAITING_REVIEW");
    expect(retryRun.attempt).toBe(2);
    expect(retryRun.proposal?.proposalId).toBe("prop-attempt-2");
    expect(retryRun.diagnostics?.length).toBeGreaterThan(0);
    expect(retryRun.attempts?.length).toBe(2);
    expect(retryRun.attempts?.[0].state).toBe("VERIFICATION_FAILED");

    // Approve Attempt 2 (which passes regression checks)
    const verifiedRun = await reviewAndApplyRepairRun(
      retryRun.runId,
      {
        proposalId: retryRun.proposal!.proposalId,
        proposalHash: retryRun.proposal!.proposalHash,
        decision: "APPROVED",
      },
      mockDeps
    );

    expect(verifiedRun.state).toBe("VERIFIED");
    expect(verifiedRun.attempt).toBe(2);
    expect(verifiedRun.attempts?.length).toBe(2);
    expect(verifiedRun.attempts?.[1].state).toBe("VERIFIED");
  }, 30_000);

  it("supports rejecting a proposal and stops the run cleanly", async () => {
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {},
      run: async () => createMockRunResult("ASSERTION_FAILED"),
    };

    const run = await createAndStartRepairRun(
      testCaseId,
      {
        mode: "simulated",
        simulatedProposal: {
          diagnosis: "Cart reset needs descriptive comment",
          assumptions: ["Items array is reset"],
          rationale: "Add descriptive comment to clearCart",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // reset items",
            },
          ],
        },
      },
      mockDeps
    );

    createdRunId = run.runId;

    const rejectedRun = await reviewAndApplyRepairRun(
      run.runId,
      {
        proposalId: run.proposal!.proposalId,
        proposalHash: run.proposal!.proposalHash,
        decision: "REJECTED",
        reviewerNotes: "Rejected for testing",
      },
      mockDeps
    );

    expect(rejectedRun.state).toBe("REJECTED");
    expect(rejectedRun.review?.decision).toBe("REJECTED");
  }, 30_000);

  it("handles run cancellation cleanly and prevents subsequent review or application", async () => {
    let appStopped = false;
    const mockDeps: Partial<RepairDependencies> = {
      startApp: async () => ({ port: 5199, url: "http://localhost:5199", process: {} as any }),
      stopApp: async () => {
        appStopped = true;
      },
      run: async () => createMockRunResult("ASSERTION_FAILED"),
    };

    const run = await createAndStartRepairRun(
      testCaseId,
      {
        mode: "simulated",
        simulatedProposal: {
          diagnosis: "Cart reset needs descriptive comment",
          assumptions: ["Items array is reset"],
          rationale: "Add descriptive comment to clearCart",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // reset items",
            },
          ],
        },
      },
      mockDeps
    );

    createdRunId = run.runId;
    expect(run.state).toBe("AWAITING_REVIEW");

    // Cancel the run
    const cancelled = await cancelRepairRun(run.runId, "Operator cancelled execution", mockDeps);
    expect(cancelled.state).toBe("CANCELLED");
    expect(cancelled.stopReason).toContain("Operator cancelled execution");
    expect(appStopped).toBe(true);

    // Attempting to review or apply after cancellation must fail
    await expect(
      reviewAndApplyRepairRun(
        run.runId,
        {
          proposalId: run.proposal!.proposalId,
          proposalHash: run.proposal!.proposalHash,
          decision: "APPROVED",
        },
        mockDeps
      )
    ).rejects.toThrow(/Cannot review or apply a cancelled repair run/);
  }, 30_000);
});
