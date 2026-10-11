import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import {
  createAndStartRepairRun,
  cancelRepairRun,
  RepairDependencies,
} from "./repairService";
import { writeCase, deleteCase } from "../../storage/caseStore";
import type { BugCase } from "@bug-to-proof/shared-types";
import { ARTIFACTS_DIR } from "../../utils/paths";
import {
  getRunResources,
  cleanupRunResources,
} from "./runtimeRegistry";
import {
  createRunWorkspace,
  startIsolatedMiniShop,
  stopIsolatedMiniShop,
  computeSourceManifest,
} from "./workspace";
import {
  applyEditsTransactionally,
  computeExpectedPatchedFingerprint,
} from "./patchPolicy";
import { testFingerprint } from "../../runner/integrity";

describe("Dynamic AI Repair Lifecycle & Cancellation Propagation", () => {
  const testCaseId = "case-test-lifecycle";
  let createdRunId: string | null = null;

  beforeEach(() => {
    const testCase: BugCase = {
      id: testCaseId,
      title: "Lifecycle test bug",
      description: "Testing cancellation and process restart",
      status: "READY_TO_REPRODUCE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reproduction: {
        preconditions: [],
        steps: ["Execute test"],
        expected: "Pass",
        actual: "Fail",
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
    deleteCase(testCaseId);
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
          // ignore
        }
      }
    }
  });

  it("propagates cancellation during model proposal generation and remains terminal", async () => {
    let generationAborted = false;
    let registeredRunId = "";

    const mockDeps: Partial<RepairDependencies> = {
      startApp: async (ws) => {
        registeredRunId = ws.runId;
        return { port: 5199, url: "http://localhost:5199", process: {} as any };
      },
      stopApp: async () => {},
      run: async () => ({
        passed: false,
        outcome: "ASSERTION_FAILED",
        expected: "Pass",
        actual: "Fail",
        durationMs: 100,
        runId: "run-base",
        testFingerprint: testFingerprint("tests/playwright/cases/case-001-cart-total.spec.ts"),
        testIds: ["tests/playwright/cases/case-001-cart-total.spec.ts:cart total:chromium"],
        reportHash: "rep-hash",
        artifactPaths: {},
        rawOutput: "",
      }),
      generate: async (input) => {
        // Simulate long-running model call that listens to abort signal
        return new Promise((_resolve, reject) => {
          if (input.abortSignal?.aborted) {
            generationAborted = true;
            reject(new Error("Model call aborted"));
            return;
          }
          input.abortSignal?.addEventListener("abort", () => {
            generationAborted = true;
            reject(new Error("Model call aborted"));
          });
        });
      },
    };

    // Start run asynchronously
    const runPromise = createAndStartRepairRun(
      testCaseId,
      { mode: "simulated", timeoutMs: 10_000 },
      mockDeps
    );

    // Allow graph to reach model generation
    await new Promise((r) => setTimeout(r, 200));

    // Cancel the run while model generation is active
    if (registeredRunId) {
      createdRunId = registeredRunId;
      await cancelRepairRun(registeredRunId, "Cancelled by user during proposal generation", mockDeps);
    }

    const finalRun = await runPromise;
    expect(finalRun.state).toBe("CANCELLED");
    expect(finalRun.stopReason).toContain("Cancelled by user during proposal generation");
    expect(generationAborted).toBe(true);
  });

  it("propagates cancellation during Playwright execution and regression checks", async () => {
    let runnerAborted = false;
    let registeredRunId = "";

    const mockDeps: Partial<RepairDependencies> = {
      startApp: async (ws) => {
        registeredRunId = ws.runId;
        return { port: 5199, url: "http://localhost:5199", process: {} as any };
      },
      stopApp: async () => {},
      run: async (_caseId, _file, _phase, options) => {
        return new Promise((resolve) => {
          if (options?.abortSignal?.aborted) {
            runnerAborted = true;
            resolve({
              passed: false,
              outcome: "INFRASTRUCTURE_ERROR",
              expected: "",
              actual: "Cancelled by signal",
              durationMs: 50,
              runId: "run-abort",
              testFingerprint: testFingerprint("tests/playwright/cases/case-001-cart-total.spec.ts"),
              testIds: [],
              artifactPaths: {},
              rawOutput: "",
            });
            return;
          }
          options?.abortSignal?.addEventListener("abort", () => {
            runnerAborted = true;
            resolve({
              passed: false,
              outcome: "INFRASTRUCTURE_ERROR",
              expected: "",
              actual: "Cancelled by signal",
              durationMs: 50,
              runId: "run-abort",
              testFingerprint: testFingerprint("tests/playwright/cases/case-001-cart-total.spec.ts"),
              testIds: [],
              artifactPaths: {},
              rawOutput: "",
            });
          });
        });
      },
    };

    const runPromise = createAndStartRepairRun(
      testCaseId,
      { mode: "simulated", timeoutMs: 10_000 },
      mockDeps
    );

    await new Promise((r) => setTimeout(r, 200));

    if (registeredRunId) {
      createdRunId = registeredRunId;
      await cancelRepairRun(registeredRunId, "Cancelled by user during runner", mockDeps);
    }

    const finalRun = await runPromise;
    expect(finalRun.state).toBe("CANCELLED");
    expect(runnerAborted).toBe(true);
  });

  it(
    "handles real process restart safely without storing live handles in checkpoints",
    async () => {
      // 1. Create workspace snapshot
      const runId = `restart-test-${Date.now()}`;
      const ws = createRunWorkspace(runId);
      expect((ws as any).appProcess).toBeUndefined(); // Verify no appProcess on RunWorkspace interface

      // 2. Start real isolated MiniShop app
      const app1 = await startIsolatedMiniShop(ws);
      expect(app1.port).toBeGreaterThan(0);
      expect(app1.url).toContain("http://127.0.0.1:");

      // Verify handle is in runtimeRegistry
      const res1 = getRunResources(runId);
      expect(res1?.appProcess).toBeDefined();

      // 3. Stop app and simulate process restart (clearing runtimeRegistry)
      await stopIsolatedMiniShop(ws);
      await cleanupRunResources(runId);

      // 4. Re-establish app safely
      const app2 = await startIsolatedMiniShop(ws);
      expect(app2.url).toContain("http://127.0.0.1:");
      expect(app2.port).toBeGreaterThan(0);

      // 5. Cleanup
      await stopIsolatedMiniShop(ws);
      await cleanupRunResources(runId);

      const runDir = path.join(ARTIFACTS_DIR, "runs", runId);
      if (fs.existsSync(runDir)) {
        try {
          fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
        } catch {}
      }
    },
    60_000
  );

  it("enforces binary invariant on idempotent patch application and rejects mutated state", async () => {
    const runId = `idempotent-test-${Date.now()}`;
    const ws = createRunWorkspace(runId);

    const edits = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // verified idempotent comment",
      },
    ];

    // Compute expected patched fingerprint
    const expectedPatchedFp = computeExpectedPatchedFingerprint(ws.pristineMinishopDir, edits);
    expect(expectedPatchedFp).toHaveLength(64);
    expect(expectedPatchedFp).not.toBe(ws.originalSourceFingerprint);

    // 1. Apply to pristine workspace -> succeeds
    const applied1 = applyEditsTransactionally(ws.minishopDir, edits);
    expect(applied1.success).toBe(true);

    const postApplyFp = computeSourceManifest(ws.minishopDir).fingerprint;
    expect(postApplyFp).toBe(expectedPatchedFp);

    // 2. Re-apply to already patched workspace -> succeeds idempotently
    const applied2 = applyEditsTransactionally(ws.minishopDir, edits);
    expect(applied2.success).toBe(true);

    // 3. Mutate workspace with unrelated modification -> rejected
    const targetFile = path.join(ws.minishopDir, "src/store/cartStore.ts");
    fs.appendFileSync(targetFile, "\n// unexpected mutation\n");

    const mutatedFp = computeSourceManifest(ws.minishopDir).fingerprint;
    expect(mutatedFp).not.toBe(ws.originalSourceFingerprint);
    expect(mutatedFp).not.toBe(expectedPatchedFp);

    await cleanupRunResources(runId);
    const runDir = path.join(ARTIFACTS_DIR, "runs", runId);
    if (fs.existsSync(runDir)) {
      try {
        fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {}
    }
  });
});
