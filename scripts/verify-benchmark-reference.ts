import crypto from "crypto";
import fs from "fs";
import path from "path";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../services/api/src/utils/paths";
import { runTest, testFingerprint } from "../services/api/src/runner/playwrightRunner";
import {
  createRunWorkspace,
  releaseWorkspaceLock,
  startIsolatedMiniShop,
  stopIsolatedMiniShop,
  computeSourceManifest,
} from "../services/api/src/ai/repair/workspace";
import { runRequiredChecks } from "../services/api/src/ai/repair/verification";

export interface BenchmarkDefect {
  relativePath: string;
  buggyContent: string;
  fixedContent: string;
}

export interface BenchmarkCaseDef {
  id: string;
  title: string;
  description: string;
  reproductionTest: string;
  split?: string;
  defect?: BenchmarkDefect;
  defects?: BenchmarkDefect[];
  diagnosis?: string;
}

export interface BenchmarkCaseResult {
  id: string;
  title: string;
  type: string;
  runId: string;
  testFingerprint: string;
  reproductionTest: string;
  baselineOutcome?: string;
  baselinePassed?: boolean;
  postPatchOutcome?: string;
  postPatchPassed?: boolean;
  checksCount?: number;
  checksPassed?: boolean;
  status: "VERIFIED" | "BASELINE_FAILED" | "POST_PATCH_FAILED" | "REGRESSION_FAILED" | "ERROR";
  evidencePaths?: {
    baseline: string;
    verification: string;
    checks: string;
  };
  error?: string;
}

export const TARGET_BENCHMARK_CASE_IDS = [
  "case-006-nav-cart-count",
  "case-007-promo-discount",
  "case-008-tiered-shipping",
];

export async function verifyBenchmarkReference(options?: {
  caseIds?: string[];
  injectRegressionFailure?: boolean;
}): Promise<{
  datasetHash: string;
  casesEvaluated: number;
  allVerified: boolean;
  results: BenchmarkCaseResult[];
}> {
  console.log("========================================================================");
  console.log(" Real Browser Reference Validation for Expanded MiniShop Benchmark Cases");
  console.log("========================================================================");

  // 1. Load canonical dataset and compute cryptographic dataset hash
  const datasetPath = path.join(WORKSPACE_ROOT, "data", "evals", "repair-cases.json");
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Canonical benchmark dataset not found at ${datasetPath}`);
  }
  const datasetRaw = fs.readFileSync(datasetPath, "utf-8");
  const datasetHash = crypto.createHash("sha256").update(datasetRaw).digest("hex");
  const datasetCases: BenchmarkCaseDef[] = JSON.parse(datasetRaw);

  // Filter requested cases
  const requestedIds = options?.caseIds && options.caseIds.length > 0
    ? options.caseIds
    : TARGET_BENCHMARK_CASE_IDS;

  const targetCases = requestedIds.map((id) => {
    const found = datasetCases.find((c) => c.id === id);
    if (!found) {
      throw new Error(`Case '${id}' not found in canonical benchmark dataset ${datasetPath}`);
    }
    return found;
  });

  const evidenceDir = path.join(ARTIFACTS_DIR, "evaluation", "reference-browser-validation");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const evidenceFile = path.join(evidenceDir, "reference-browser-results.json");

  // 2. Verify primary workspace source integrity before execution
  const primaryMinishopDir = path.join(WORKSPACE_ROOT, "apps", "minishop");
  const initialPrimaryManifest = computeSourceManifest(primaryMinishopDir);

  const results: BenchmarkCaseResult[] = [];

  const writePartialResults = (isFinal: boolean) => {
    const output = {
      timestamp: new Date().toISOString(),
      mode: "REAL_BROWSER_REFERENCE_VALIDATION",
      datasetHash,
      datasetPath: path.relative(WORKSPACE_ROOT, datasetPath).replace(/\\/g, "/"),
      primarySourceFingerprint: initialPrimaryManifest.fingerprint,
      casesRequested: requestedIds.length,
      casesEvaluated: results.length,
      allVerified: results.length > 0 && results.every((r) => r.status === "VERIFIED"),
      isComplete: isFinal,
      results,
    };
    fs.writeFileSync(evidenceFile, JSON.stringify(output, null, 2), "utf-8");
  };

  try {
    for (const c of targetCases) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`[Case ${c.id}] "${c.title}"`);
      console.log(`------------------------------------------------------------------------`);

      const defects: BenchmarkDefect[] = c.defects || (c.defect ? [c.defect] : []);
      if (defects.length === 0) {
        throw new Error(`Case '${c.id}' has no defect definitions in canonical dataset`);
      }

      const runId = `ref-eval-${c.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const testFp = testFingerprint(c.reproductionTest);
      const ws = createRunWorkspace(runId);
      let app: { port: number; url: string; process: any } | null = null;
      let cleanupError: Error | null = null;

      try {
        // [1/4] Seed Defect in isolated workspace
        console.log(`  [1/4] Seeding defect in isolated workspace (${ws.minishopDir})...`);
        for (const d of defects) {
          const fullP = path.join(ws.minishopDir, d.relativePath);
          if (!fs.existsSync(fullP)) {
            throw new Error(`Target defect file '${d.relativePath}' not found in workspace`);
          }
          const cur = fs.readFileSync(fullP, "utf-8");
          if (!cur.includes(d.fixedContent)) {
            throw new Error(
              `Failed to seed defect in '${d.relativePath}': canonical fixedContent snippet not found`
            );
          }
          const patched = cur.replace(d.fixedContent, d.buggyContent);
          fs.writeFileSync(fullP, patched, "utf-8");
        }

        // [2/4] Start isolated MiniShop and run baseline Playwright test
        console.log(`  [2/4] Starting isolated MiniShop and running baseline Playwright reproduction...`);
        app = await startIsolatedMiniShop(ws);

        const baselineArtifactDir = path.join(ARTIFACTS_DIR, "runs", runId, "baseline");
        const baselineRun = await runTest(c.id, c.reproductionTest, "before", {
          targetUrl: app.url,
          artifactDir: baselineArtifactDir,
          runId,
        });

        console.log(`        Baseline Outcome: ${baselineRun.outcome} (Expected: ASSERTION_FAILED)`);
        const baselineAssertionFailed =
          baselineRun.outcome === "ASSERTION_FAILED" && baselineRun.passed === false;

        // [3/4] Apply Reference Fix in isolated workspace
        console.log(`  [3/4] Applying canonical reference fix in isolated workspace...`);
        for (const d of defects) {
          const fullP = path.join(ws.minishopDir, d.relativePath);
          const cur = fs.readFileSync(fullP, "utf-8");
          if (!cur.includes(d.buggyContent)) {
            throw new Error(
              `Failed to apply reference fix in '${d.relativePath}': buggyContent snippet not found`
            );
          }
          const fixed = cur.replace(d.buggyContent, d.fixedContent);
          fs.writeFileSync(fullP, fixed, "utf-8");
        }

        // [4/4] Run post-patch Playwright test and regression checks
        console.log(`  [4/4] Running post-patch Playwright test and regression checks...`);
        const postPatchArtifactDir = path.join(ARTIFACTS_DIR, "runs", runId, "verification");
        const postPatchRun = await runTest(c.id, c.reproductionTest, "after", {
          targetUrl: app.url,
          artifactDir: postPatchArtifactDir,
          runId,
        });

        console.log(`        Post-Patch Outcome: ${postPatchRun.outcome} (Expected: PASSED)`);
        const postPatchPassed =
          postPatchRun.outcome === "PASSED" && postPatchRun.passed === true;

        // Regression checks
        const checksArtifactDir = path.join(ARTIFACTS_DIR, "runs", runId);
        const checks = await runRequiredChecks(ws.minishopDir, checksArtifactDir, { runId });
        let checksPassed = checks.length >= 3 && checks.every((chk) => chk.passed && chk.exitCode === 0);

        if (options?.injectRegressionFailure) {
          console.log("        [TEST INJECTION] Simulating regression check failure...");
          checksPassed = false;
        }

        console.log(
          `        Regression Checks: ${checks.length} checks (${checksPassed ? "ALL PASSED" : "FAILED"})`
        );

        let status: BenchmarkCaseResult["status"] = "VERIFIED";
        if (!baselineAssertionFailed) {
          status = "BASELINE_FAILED";
        } else if (!postPatchPassed) {
          status = "POST_PATCH_FAILED";
        } else if (!checksPassed) {
          status = "REGRESSION_FAILED";
        }

        results.push({
          id: c.id,
          title: c.title,
          type: c.split || "benchmark",
          runId,
          testFingerprint: testFp,
          reproductionTest: c.reproductionTest,
          baselineOutcome: baselineRun.outcome,
          baselinePassed: baselineRun.passed,
          postPatchOutcome: postPatchRun.outcome,
          postPatchPassed: postPatchRun.passed,
          checksCount: checks.length,
          checksPassed,
          status,
          evidencePaths: {
            baseline: path.relative(WORKSPACE_ROOT, baselineArtifactDir).replace(/\\/g, "/"),
            verification: path.relative(WORKSPACE_ROOT, postPatchArtifactDir).replace(/\\/g, "/"),
            checks: path.relative(WORKSPACE_ROOT, path.join(checksArtifactDir, "checks")).replace(/\\/g, "/"),
          },
        });
      } catch (caseErr: any) {
        console.error(`  [Case ${c.id}] Error during evaluation:`, caseErr.message || caseErr);
        results.push({
          id: c.id,
          title: c.title,
          type: c.split || "benchmark",
          runId,
          testFingerprint: testFp,
          reproductionTest: c.reproductionTest,
          status: "ERROR",
          error: caseErr.message || String(caseErr),
        });
      } finally {
        // Guaranteed process termination and workspace cleanup
        if (app) {
          try {
            await stopIsolatedMiniShop(ws);
          } catch (stopErr: any) {
            console.error(`  [Cleanup Warning] Failed to stop MiniShop for ${runId}:`, stopErr.message);
            cleanupError = stopErr;
          }
        }
        try {
          releaseWorkspaceLock(ws);
        } catch (lockErr: any) {
          console.error(`  [Cleanup Warning] Failed to release lock for ${runId}:`, lockErr.message);
          if (!cleanupError) cleanupError = lockErr;
        }
      }

      writePartialResults(false);
    }
  } finally {
    // 3. Guarantee primary source immutability check
    const finalPrimaryManifest = computeSourceManifest(primaryMinishopDir);
    if (finalPrimaryManifest.fingerprint !== initialPrimaryManifest.fingerprint) {
      console.error("FATAL: Primary source was mutated during benchmark validation!");
      throw new Error(
        `Primary source integrity violation: before ${initialPrimaryManifest.fingerprint} vs after ${finalPrimaryManifest.fingerprint}`
      );
    }
  }

  writePartialResults(true);

  const allVerified = results.length > 0 && results.every((r) => r.status === "VERIFIED");

  console.log("\n========================================================================");
  console.log(
    ` Real Browser Reference Validation: ${allVerified ? "ALL CASES VERIFIED" : "SOME CASES FAILED"}`
  );
  console.log(` Total Cases Evaluated: ${results.length}`);
  console.log(` Dataset Hash: ${datasetHash}`);
  console.log(` Primary Source Fingerprint: ${initialPrimaryManifest.fingerprint} (INTACT)`);
  console.log(` Evidence saved to: ${evidenceFile}`);
  console.log("========================================================================");

  return {
    datasetHash,
    casesEvaluated: results.length,
    allVerified,
    results,
  };
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const cliArgs = process.argv.slice(2);
  const targetIds = cliArgs.filter((a) => !a.startsWith("--"));

  verifyBenchmarkReference({ caseIds: targetIds.length > 0 ? targetIds : undefined })
    .then((res) => {
      if (!res.allVerified) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Benchmark reference verification fatal error:", err);
      process.exit(1);
    });
}
