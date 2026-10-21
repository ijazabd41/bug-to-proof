import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "@langchain/langgraph";
import { testFingerprint } from "../../runner/integrity";
import { buildRepairGraph, RepairGraphDependencies } from "./repairGraph";
import { writeCase, deleteCase } from "../../storage/caseStore";
import { getRunRecord } from "./runStore";
import { computeProposalHash } from "./contracts";
import type { BugCase } from "@bug-to-proof/shared-types";
import type { ModelProposal, ProposalReview, RequiredCheckResult } from "./contracts";

describe("LangGraph Dynamic Repair Orchestrator (repairGraph)", () => {
  const testCaseId = "test-graph-case-001";
  const reproductionFile = "tests/playwright/cases/case-001-cart-total.spec.ts";

  const mockCase: BugCase = {
    id: testCaseId,
    title: "Cart total calculation error",
    description: "Adding items shows incorrect total",
    status: "READY_TO_REPRODUCE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reproduction: {
      preconditions: [],
      steps: ["Add item 1", "Add item 2"],
      expected: "Total is $30.00",
      actual: "Total is $10.00",
      testFile: reproductionFile,
      lastRun: null,
    },
    patch: null,
    verification: null,
    evidence: [],
    rootCauseExplanation: null,
  };

  const sampleEdits = [
    {
      relativePath: "src/store/cartStore.ts",
      oldContent: "  total: () => get().items[0]?.price ?? 0,",
      newContent: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
    },
  ];

  const sampleProposal: ModelProposal = {
    schemaVersion: "1.0",
    proposalId: "prop-graph-test-1",
    diagnosis: "Total only reads first item price",
    assumptions: ["Standard cart logic"],
    rationale: "Use array reduce to calculate total",
    edits: sampleEdits,
    unifiedDiff: "--- a/src/store/cartStore.ts\n+++ b/src/store/cartStore.ts\n@@\n-total: () => get().items[0]?.price ?? 0,\n+total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),\n",
    proposalHash: computeProposalHash(sampleEdits, "Total only reads first item price", "Use array reduce to calculate total"),
    proposedAt: new Date().toISOString(),
  };

  const sampleChecks: RequiredCheckResult[] = [
    {
      checkId: "check-typecheck",
      name: "TypeScript compilation",
      type: "typecheck",
      command: "tsc --noEmit",
      passed: true,
      exitCode: 0,
      durationMs: 250,
      output: "Found 0 errors",
    },
    {
      checkId: "check-build",
      name: "Vite build",
      type: "build",
      command: "vite build",
      passed: true,
      exitCode: 0,
      durationMs: 350,
      output: "built in 0.3s",
    },
    {
      checkId: "check-unit-tests",
      name: "MiniShop unit tests",
      type: "unit-tests",
      command: "vitest run apps/minishop",
      passed: true,
      exitCode: 0,
      durationMs: 180,
      output: "3 passed",
    },
  ];

  beforeEach(() => {
    writeCase(mockCase);
  });

  afterEach(() => {
    deleteCase(testCaseId);
  });

  it("executes graph from initialization to human review pause (AWAITING_REVIEW)", async () => {
    const runId = `graph-run-${Date.now()}`;

    const mockDeps: Partial<RepairGraphDependencies> = {
      startApp: async () => ({ port: 5310, url: "http://localhost:5310", process: {} as any }),
      stopApp: async () => {},
      run: async (_c, _f, phase) => ({
        passed: phase === "after",
        outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
        expected: "Total is $30.00",
        actual: phase === "before" ? "Total is $10.00" : "Total is $30.00",
        durationMs: 120,
        runId: `run-${phase}`,
        testFingerprint: "fp-test",
        testIds: [`${reproductionFile}:cart total should equal sum:chromium`],
        reportHash: "hash-test",
        artifactPaths: {},
        rawOutput: "mock output",
      }),
      generate: async () => sampleProposal,
      checks: async () => sampleChecks,
    };

    const graph = buildRepairGraph(mockDeps);

    const result = await graph.invoke(
      {
        runId,
        caseId: testCaseId,
        caseTitle: mockCase.title,
        caseDescription: mockCase.description,
        reproductionTestFile: reproductionFile,
        testFingerprint: "fp-test",
        config: {
          mode: "simulated",
          seedDefects: [
            {
              relativePath: "src/store/cartStore.ts",
              originalSnippet: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
              defectiveSnippet: "  total: () => get().items[0]?.price ?? 0,",
            },
          ],
        },
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        diagnostics: [],
        requiredChecks: [],
        events: [],
      },
      { configurable: { thread_id: runId } }
    );

    expect(result.state).toBe("AWAITING_REVIEW");
    expect(result.proposal).toBeDefined();
    expect(result.proposal?.proposalHash).toBe(sampleProposal.proposalHash);
    expect(result.attempts.length).toBe(1);

    const savedRecord = getRunRecord(runId);
    expect(savedRecord).toBeDefined();
    expect(savedRecord?.state).toBe("AWAITING_REVIEW");
  });

  it("finishes BLOCKED when patch generation returns an empty-provider failure", async () => {
    const runId = `graph-run-empty-provider-${Date.now()}`;
    const graph = buildRepairGraph({
      startApp: async () => ({ port: 5319, url: "http://localhost:5319", process: {} as any }),
      stopApp: async () => {},
      run: async () => ({
        passed: false, outcome: "ASSERTION_FAILED", expected: "Total is $30.00", actual: "Total is $10.00",
        durationMs: 10, runId: "run-before-empty", testFingerprint: "fp-empty", testIds: ["empty-provider-test"],
        reportHash: "report-empty", artifactPaths: {
          screenshot: `artifacts/runs/${runId}/baseline/failure/test-failed-1.png`,
          trace: `artifacts/runs/${runId}/baseline/failure/trace.zip`,
          resultJson: `artifacts/runs/${runId}/baseline/result.json`,
        }, rawOutput: "",
      }),
      generate: async () => { throw new Error("Model returned an empty response. Verify LLM configuration and credentials."); },
      checks: async () => [],
    });

    const result = await graph.invoke({
      runId, caseId: testCaseId, caseTitle: mockCase.title, caseDescription: mockCase.description,
      reproductionTestFile: reproductionFile, testFingerprint: "fp-empty", config: { mode: "simulated" },
      state: "INITIALIZING", attempt: 1, maxAttempts: 3, attempts: [], diagnostics: [], requiredChecks: [], events: [],
    }, { configurable: { thread_id: runId } });

    expect(result.state).toBe("BLOCKED");
    expect(result.stopReason).toContain("Patch generation provider returned no usable content");
    expect(result.error).toContain("no usable patch content");
    expect(result.baselineArtifacts?.screenshot).toContain("test-failed-1.png");
  });

  it("stops at baseline reproduction with BLOCKED if failure is not reproduced", async () => {
    const runId = `graph-run-unreproduced-${Date.now()}`;

    const mockDeps: Partial<RepairGraphDependencies> = {
      startApp: async () => ({ port: 5311, url: "http://localhost:5311", process: {} as any }),
      stopApp: async () => {},
      run: async () => ({
        passed: true,
        outcome: "PASSED", // Bug not reproduced!
        expected: "Total is $30.00",
        actual: "Total is $30.00",
        durationMs: 100,
        runId: "run-passed",
        testFingerprint: "fp-test",
        testIds: [`${reproductionFile}:cart total should equal sum:chromium`],
        artifactPaths: {},
        rawOutput: "clean pass",
      }),
      generate: async () => sampleProposal,
      checks: async () => sampleChecks,
    };

    const graph = buildRepairGraph(mockDeps);

    const result = await graph.invoke(
      {
        runId,
        caseId: testCaseId,
        caseTitle: mockCase.title,
        caseDescription: mockCase.description,
        reproductionTestFile: reproductionFile,
        testFingerprint: "fp-test",
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        diagnostics: [],
        requiredChecks: [],
        events: [],
      },
      { configurable: { thread_id: runId } }
    );

    expect(result.state).toBe("BLOCKED");
    expect(result.stopReason).toContain("not reproduced");
  });

  it("resumes exact approved proposal, runs post-patch reproduction, and completes VERIFIED", async () => {
    const runId = `graph-run-verify-${Date.now()}`;

    const realFp = testFingerprint(reproductionFile);
    const mockDeps: Partial<RepairGraphDependencies> = {
      startApp: async () => ({ port: 5312, url: "http://localhost:5312", process: {} as any }),
      stopApp: async () => {},
      run: async (_c, _f, phase) => ({
        passed: phase === "after",
        outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
        expected: "Total is $30.00",
        actual: phase === "before" ? "Total is $10.00" : "Total is $30.00",
        durationMs: 110,
        runId: `run-${phase}`,
        testFingerprint: realFp,
        testIds: [`${reproductionFile}:cart total should equal sum:chromium`],
        reportHash: "report-hash",
        artifactPaths: {},
        rawOutput: "",
      }),
      generate: async () => sampleProposal,
      checks: async () => sampleChecks,
    };

    const graph = buildRepairGraph(mockDeps);

    // 1. Run up to pause
    const paused = await graph.invoke(
      {
        runId,
        caseId: testCaseId,
        caseTitle: mockCase.title,
        caseDescription: mockCase.description,
        reproductionTestFile: reproductionFile,
        testFingerprint: realFp,
        config: {
          mode: "simulated",
          seedDefects: [
            {
              relativePath: "src/store/cartStore.ts",
              originalSnippet: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
              defectiveSnippet: "  total: () => get().items[0]?.price ?? 0,",
            },
          ],
        },
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        diagnostics: [],
        requiredChecks: [],
        events: [],
      },
      { configurable: { thread_id: runId } }
    );

    expect(paused.state).toBe("AWAITING_REVIEW");

    // 2. Submit approval review
    const review: ProposalReview = {
      proposalId: sampleProposal.proposalId,
      proposalHash: sampleProposal.proposalHash,
      decision: "APPROVED",
      reviewerNotes: "Looks correct",
    };

    // 3. Resume graph using Command({ resume: review })
    const finalized = await graph.invoke(
      new Command({ resume: review }),
      { configurable: { thread_id: runId } }
    );

    expect(finalized.state).toBe("VERIFIED");
    expect(finalized.requiredChecks.length).toBe(3);
    expect(finalized.requiredChecks.every((c: RequiredCheckResult) => c.passed)).toBe(true);

    const savedRecord = getRunRecord(runId);
    expect(savedRecord?.state).toBe("VERIFIED");
  }, 30_000);

  it("handles reviewer rejection by stopping the run cleanly with status REJECTED", async () => {
    const runId = `graph-run-reject-${Date.now()}`;

    const mockDeps: Partial<RepairGraphDependencies> = {
      startApp: async () => ({ port: 5313, url: "http://localhost:5313", process: {} as any }),
      stopApp: async () => {},
      run: async (_c, _f, phase) => ({
        passed: phase === "after",
        outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
        expected: "Total is $30.00",
        actual: phase === "before" ? "Total is $10.00" : "Total is $30.00",
        durationMs: 90,
        runId: `run-${phase}`,
        testFingerprint: "fp-test",
        testIds: [`${reproductionFile}:cart total should equal sum:chromium`],
        artifactPaths: {},
        rawOutput: "",
      }),
      generate: async () => sampleProposal,
      checks: async () => sampleChecks,
    };

    const graph = buildRepairGraph(mockDeps);

    // Initial run to AWAITING_REVIEW
    const initialRun = await graph.invoke(
      {
        runId,
        caseId: testCaseId,
        caseTitle: mockCase.title,
        caseDescription: mockCase.description,
        reproductionTestFile: reproductionFile,
        testFingerprint: "fp-test",
        config: {
          mode: "simulated",
          seedDefects: [
            {
              relativePath: "src/store/cartStore.ts",
              originalSnippet: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
              defectiveSnippet: "  total: () => get().items[0]?.price ?? 0,",
            },
          ],
        },
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: 2,
        attempts: [],
        diagnostics: [],
        requiredChecks: [],
        events: [],
      },
      { configurable: { thread_id: runId } }
    );

    expect(initialRun.state).toBe("AWAITING_REVIEW");

    // Reject attempt 1
    const rejectedReview: ProposalReview = {
      proposalId: sampleProposal.proposalId,
      proposalHash: sampleProposal.proposalHash,
      decision: "REJECTED",
      reviewerNotes: "Approach violates requirements",
    };

    const resumed = await graph.invoke(
      new Command({ resume: rejectedReview }),
      { configurable: { thread_id: runId } }
    );

    expect(resumed.state).toBe("REJECTED");
    expect(resumed.stopReason).toContain("Approach violates requirements");

    const savedRecord = getRunRecord(runId);
    expect(savedRecord?.state).toBe("REJECTED");
  });

  it("retries candidate generation with diagnostics when regression checks fail on attempt 1 and verifies on attempt 2", async () => {
    const runId = `graph-run-retry-${Date.now()}`;
    let checkCallCount = 0;
    let generateAttempts = 0;
    const realFp = testFingerprint(reproductionFile);

    const mockDeps: Partial<RepairGraphDependencies> = {
      startApp: async () => ({ port: 5314, url: "http://localhost:5314", process: {} as any }),
      stopApp: async () => {},
      run: async (_c, _f, phase) => ({
        passed: phase === "after",
        outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
        expected: "Total is $30.00",
        actual: phase === "before" ? "Total is $10.00" : "Total is $30.00",
        durationMs: 90,
        runId: `run-${phase}`,
        testFingerprint: realFp,
        testIds: [`${reproductionFile}:cart total should equal sum:chromium`],
        reportHash: "report-hash-retry",
        artifactPaths: {},
        rawOutput: "",
      }),
      generate: async () => {
        generateAttempts++;
        const edits = [
          {
            relativePath: "src/store/cartStore.ts",
            oldContent: "  total: () => get().items[0]?.price ?? 0,",
            newContent: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
          },
        ];
        return {
          ...sampleProposal,
          proposalId: `prop-attempt-${generateAttempts}`,
          proposalHash: computeProposalHash(edits, "Diagnosis", `Rationale attempt ${generateAttempts}`),
          edits,
        };
      },
      checks: async () => {
        checkCallCount++;
        // Attempt 1 checks fail, attempt 2 checks pass
        return [
          {
            checkId: "check-typecheck",
            name: "TypeScript compilation",
            type: "typecheck",
            command: "tsc --noEmit",
            passed: checkCallCount > 1,
            exitCode: checkCallCount > 1 ? 0 : 1,
            durationMs: 200,
            output: checkCallCount > 1 ? "Found 0 errors" : "Type error on attempt 1",
          },
          {
            checkId: "check-build",
            name: "Vite build",
            type: "build",
            command: "vite build",
            passed: checkCallCount > 1,
            exitCode: checkCallCount > 1 ? 0 : 1,
            durationMs: 300,
            output: checkCallCount > 1 ? "built in 0.3s" : "Build error on attempt 1",
          },
          {
            checkId: "check-unit-tests",
            name: "MiniShop unit tests",
            type: "unit-tests",
            command: "vitest run apps/minishop",
            passed: checkCallCount > 1,
            exitCode: checkCallCount > 1 ? 0 : 1,
            durationMs: 180,
            output: checkCallCount > 1 ? "3 passed" : "Unit test error on attempt 1",
          },
        ];
      },
    };

    const graph = buildRepairGraph(mockDeps);

    // Initial run (Attempt 1)
    const run1 = await graph.invoke(
      {
        runId,
        caseId: testCaseId,
        caseTitle: mockCase.title,
        caseDescription: mockCase.description,
        reproductionTestFile: reproductionFile,
        testFingerprint: realFp,
        config: {
          mode: "simulated",
          seedDefects: [
            {
              relativePath: "src/store/cartStore.ts",
              originalSnippet: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
              defectiveSnippet: "  total: () => get().items[0]?.price ?? 0,",
            },
          ],
        },
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        diagnostics: [],
        requiredChecks: [],
        events: [],
      },
      { configurable: { thread_id: runId } }
    );

    expect(run1.state).toBe("AWAITING_REVIEW");
    expect(run1.attempt).toBe(1);

    // Approve attempt 1 (regression checks fail -> triggers retry node -> pauses at attempt 2 AWAITING_REVIEW)
    const run2 = await graph.invoke(
      new Command({
        resume: {
          proposalId: run1.proposal!.proposalId,
          proposalHash: run1.proposal!.proposalHash,
          decision: "APPROVED",
        },
      }),
      { configurable: { thread_id: runId } }
    );

    expect(run2.state).toBe("AWAITING_REVIEW");
    expect(run2.attempt).toBe(2);
    expect(run2.diagnostics.length).toBeGreaterThan(0);
    expect(run2.attempts.length).toBe(2);
    expect(run2.attempts[0].state).toBe("VERIFICATION_FAILED");

    // Approve attempt 2 (regression checks pass -> completes VERIFIED)
    const runVerified = await graph.invoke(
      new Command({
        resume: {
          proposalId: run2.proposal!.proposalId,
          proposalHash: run2.proposal!.proposalHash,
          decision: "APPROVED",
        },
      }),
      { configurable: { thread_id: runId } }
    );

    expect(runVerified.state).toBe("VERIFIED");
    expect(runVerified.attempt).toBe(2);
    expect(runVerified.attempts.length).toBe(2);
    expect(runVerified.attempts[1].state).toBe("VERIFIED");
  }, 30_000);
});
