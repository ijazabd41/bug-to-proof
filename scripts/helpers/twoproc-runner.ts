import fs from "fs";
import path from "path";
import { Command } from "@langchain/langgraph";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../../services/api/src/utils/paths";
import { testFingerprint } from "../../services/api/src/runner/integrity";
import { computeProposalHash } from "../../services/api/src/ai/repair/contracts";
import { buildRepairGraph } from "../../services/api/src/ai/repair/repairGraph";
import { FileCheckpointSaver } from "../../services/api/src/ai/repair/fileCheckpointer";
import type { ModelProposal, RequiredCheckResult } from "../../services/api/src/ai/repair/contracts";

const testCaseId = "case-001";
const reproductionFile = "tests/playwright/cases/case-001-cart-total.spec.ts";
const realFp = testFingerprint(reproductionFile);
const reporterId = "case-001-cart-total.spec.ts:Cart Total Calculation:chromium";

const sampleEdits = [
  {
    relativePath: "src/store/cartStore.ts",
    oldContent: "  total: () => get().items[0]?.price ?? 0,",
    newContent: "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
  },
];

const sampleProposal: ModelProposal = {
  schemaVersion: "1.0",
  proposalId: "prop-audit-twoproc-1",
  diagnosis: "Cart total calculation defect",
  assumptions: ["Standard cart reduction"],
  rationale: "Sum all item prices with quantity",
  edits: sampleEdits,
  unifiedDiff: "--- diff",
  proposalHash: computeProposalHash(sampleEdits, "Cart total calculation defect", "Sum all item prices with quantity"),
  proposedAt: new Date().toISOString(),
};

const sampleChecks: RequiredCheckResult[] = [
  {
    checkId: "check-typecheck",
    name: "TypeScript compilation",
    type: "typecheck" as const,
    command: "tsc --noEmit",
    passed: true,
    exitCode: 0,
    durationMs: 250,
    output: "Found 0 errors",
  },
  {
    checkId: "check-build",
    name: "Vite build",
    type: "build" as const,
    command: "vite build",
    passed: true,
    exitCode: 0,
    durationMs: 350,
    output: "built in 0.3s",
  },
  {
    checkId: "check-unit-tests",
    name: "MiniShop unit tests",
    type: "unit-tests" as const,
    command: "vitest run apps/minishop",
    passed: true,
    exitCode: 0,
    durationMs: 180,
    output: "3 passed",
  },
];

async function main() {
  const args = process.argv.slice(2);
  const stepArg = args.find((a) => a.startsWith("--step="))?.split("=")[1];
  const runIdArg = args.find((a) => a.startsWith("--runId="))?.split("=")[1];

  if (!stepArg || !runIdArg) {
    console.error("Usage: tsx twoproc-runner.ts --step=A|B|INTERRUPT_RESUME --runId=<id>");
    process.exit(1);
  }

  const checkpointer = new FileCheckpointSaver();

  if (stepArg === "A") {
    // Process A: Invokes graph up to review pause and exits
    const graphA = buildRepairGraph(
      {
        startApp: async () => ({ port: 5420, url: "http://localhost:5420", process: {} as any }),
        stopApp: async () => {},
        run: async (_c, _f, phase) => ({
          passed: phase === "after",
          outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
          expected: "Total is $30",
          actual: phase === "before" ? "Total is $10" : "Total is $30",
          durationMs: 100,
          runId: `run-${phase}`,
          testFingerprint: realFp,
          testIds: [reporterId],
          reportHash: "h-twoproc",
          artifactPaths: {},
          rawOutput: "",
        }),
        generate: async () => sampleProposal,
        checks: async () => sampleChecks,
      },
      checkpointer
    );

    const paused = await graphA.invoke(
      {
        runId: runIdArg,
        caseId: testCaseId,
        caseTitle: "Cart bug",
        caseDescription: "Desc",
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
      { configurable: { thread_id: runIdArg } }
    );

    if (paused.state !== "AWAITING_REVIEW") {
      console.error(`Process A state was not AWAITING_REVIEW: ${paused.state}`);
      process.exit(2);
    }
    console.log(JSON.stringify({ status: "PAUSED_OK", state: paused.state, proposalId: sampleProposal.proposalId }));
    process.exit(0);
  }

  if (stepArg === "B") {
    // Process B: Completely new process loads checkpoint from disk and resumes exact proposal
    const graphB = buildRepairGraph(
      {
        startApp: async () => ({ port: 5421, url: "http://localhost:5421", process: {} as any }),
        stopApp: async () => {},
        run: async (_c, _f, phase) => ({
          passed: phase === "after",
          outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
          expected: "Total is $30",
          actual: phase === "before" ? "Total is $10" : "Total is $30",
          durationMs: 100,
          runId: `run-${phase}`,
          testFingerprint: realFp,
          testIds: [reporterId],
          reportHash: "h-twoproc",
          artifactPaths: {},
          rawOutput: "",
        }),
        generate: async () => sampleProposal,
        checks: async () => sampleChecks,
      },
      checkpointer
    );

    const resumed = await graphB.invoke(
      new Command({
        resume: {
          proposalId: sampleProposal.proposalId,
          proposalHash: sampleProposal.proposalHash,
          decision: "APPROVED",
        },
      }),
      { configurable: { thread_id: runIdArg } }
    );

    if (resumed.state !== "VERIFIED") {
      console.error(`Process B did not finalize as VERIFIED: ${resumed.state}, error: ${resumed.error}`);
      process.exit(3);
    }
    console.log(JSON.stringify({ status: "RESUMED_OK", state: resumed.state }));
    process.exit(0);
  }

  if (stepArg === "INTERRUPT_RESUME") {
    // Tests resuming when edits were already applied (idempotent resume without double-applying)
    const graphC = buildRepairGraph(
      {
        startApp: async () => ({ port: 5422, url: "http://localhost:5422", process: {} as any }),
        stopApp: async () => {},
        run: async (_c, _f, phase) => ({
          passed: phase === "after",
          outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
          expected: "Total is $30",
          actual: phase === "before" ? "Total is $10" : "Total is $30",
          durationMs: 100,
          runId: `run-${phase}`,
          testFingerprint: realFp,
          testIds: [reporterId],
          reportHash: "h-twoproc",
          artifactPaths: {},
          rawOutput: "",
        }),
        generate: async () => sampleProposal,
        checks: async () => sampleChecks,
      },
      checkpointer
    );

    const resumedAgain = await graphC.invoke(
      new Command({
        resume: {
          proposalId: sampleProposal.proposalId,
          proposalHash: sampleProposal.proposalHash,
          decision: "APPROVED",
        },
      }),
      { configurable: { thread_id: runIdArg } }
    );

    console.log(JSON.stringify({ status: "IDEMPOTENT_RESUME_OK", state: resumedAgain.state }));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("twoproc-runner error:", err);
  process.exit(1);
});
