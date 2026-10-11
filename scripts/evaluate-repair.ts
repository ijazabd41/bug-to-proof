import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../services/api/src/utils/paths";
import { readCase, writeCase, deleteCase } from "../services/api/src/storage/caseStore";
import {
  createAndStartRepairRun,
  reviewAndApplyRepairRun,
  RepairDependencies,
} from "../services/api/src/ai/repair/repairService";
import { testFingerprint, digest } from "../services/api/src/runner/integrity";
import type { BugCase } from "@bug-to-proof/shared-types";
import type { RequiredCheckResult } from "../services/api/src/ai/repair/contracts";
import { computeProposalHash } from "../services/api/src/ai/repair/contracts";

interface DefectSnippet {
  relativePath: string;
  buggyContent: string;
  fixedContent: string;
}

interface BenchmarkCase {
  id: string;
  title: string;
  description: string;
  reproductionTest: string;
  split: "dev" | "held-out";
  defect?: DefectSnippet;
  defects?: DefectSnippet[];
  diagnosis: string;
}

function getCaseDefects(bCase: BenchmarkCase): DefectSnippet[] {
  if (Array.isArray(bCase.defects) && bCase.defects.length > 0) {
    return bCase.defects;
  }
  if (bCase.defect) {
    return [bCase.defect];
  }
  return [];
}

interface EvaluationResult {
  id: string;
  title: string;
  split: "dev" | "held-out";
  mode: "live" | "simulated";
  runId: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  datasetHash: string;
  sourceFingerprint?: string;
  artifactLinks?: {
    runDir?: string;
    baselineArtifacts?: string;
    verificationArtifacts?: string;
    checksArtifacts?: string;
  };
  baselineReproduction: "ASSERTION_FAILED" | "PASSED" | "ERROR" | "SKIPPED";
  proposalGenerated: boolean;
  verified: boolean;
  state: string;
  attemptsUsed: number;
  allChecksPassed: boolean;
  durationMs: number;
  failureReasons: string[];
  tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | "unknown";
  estimatedCost: number | "unknown";
  stopReason?: string;
  error?: string;
  proposalDiff?: string;
}

async function main() {
  loadEnv({ path: path.join(WORKSPACE_ROOT, ".env") });

  const args = process.argv.slice(2);
  const isSimulated = args.includes("--simulated");
  const caseFilterIdx = args.indexOf("--case");
  const targetCaseId = caseFilterIdx !== -1 && args[caseFilterIdx + 1] ? args[caseFilterIdx + 1] : null;
  const splitFilterIdx = args.indexOf("--split");
  const targetSplit = splitFilterIdx !== -1 && args[splitFilterIdx + 1] ? args[splitFilterIdx + 1] : null;
  const maxAttemptsIdx = args.indexOf("--max-attempts");
  const maxAttempts = maxAttemptsIdx !== -1 && args[maxAttemptsIdx + 1] ? parseInt(args[maxAttemptsIdx + 1], 10) : 3;

  const datasetPath = path.join(WORKSPACE_ROOT, "data/evals/repair-cases.json");
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Repair benchmark dataset not found at ${datasetPath}`);
  }

  const rawData = fs.readFileSync(datasetPath, "utf-8").replace(/^\uFEFF/, "");
  const datasetHash = digest(rawData);
  let cases: BenchmarkCase[] = JSON.parse(rawData);

  if (targetCaseId) {
    cases = cases.filter((c) => c.id === targetCaseId);
  }
  if (targetSplit) {
    cases = cases.filter((c) => c.split === targetSplit);
  }

  if (cases.length === 0) {
    console.log("No evaluation cases matched the specified criteria.");
    return;
  }

  const evalArtifactsDir = path.join(ARTIFACTS_DIR, "evaluation");
  fs.mkdirSync(evalArtifactsDir, { recursive: true });

  const provider = isSimulated ? "simulated" : process.env.RAG_GENERATION_PROVIDER || "openai";
  const model = isSimulated ? "fixture" : process.env.RAG_GENERATION_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

  console.log(`\n========================================================================`);
  if (isSimulated) {
    console.log(` [SIMULATED WORKFLOW HARNESS TEST] — NOT REAL MODEL EVALUATION `);
    console.log(` Mode: Synthetic Fixtures | Tests state transitions and isolation gates`);
  } else {
    console.log(` Bug-to-Proof Dynamic AI Repair Evaluation Benchmark (Live Runner) `);
    console.log(` Mode: Live Execution | Provider: ${provider} | Model: ${model}`);
  }
  console.log(` Dataset Hash: ${datasetHash.slice(0, 12)}...`);
  console.log(`========================================================================\n`);
  console.log(
    `Loaded ${cases.length} evaluation cases (${cases.filter((c) => c.split === "dev").length} dev, ${cases.filter((c) => c.split === "held-out").length} held-out).\n`
  );

  const results: EvaluationResult[] = [];
  const startAll = Date.now();

  for (const bCase of cases) {
    console.log(`[EVAL] Running Case ${bCase.id} (${bCase.split}) - "${bCase.title}"...`);
    const caseStart = Date.now();

    // Preserve existing case if present to avoid destructive overwrite
    const priorCase = readCase(bCase.id);

    // Register temporary case definition with its reproduction test
    const tempCase: BugCase = {
      id: bCase.id,
      title: bCase.title,
      description: bCase.description,
      status: "READY_TO_REPRODUCE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reproduction: {
        preconditions: [],
        steps: ["Execute reproduction test in isolated environment"],
        expected: "All calculations and assertions pass",
        actual: "Assertion failure on defective code",
        testFile: bCase.reproductionTest,
        lastRun: null,
      },
      patch: null,
      verification: null,
      evidence: [],
      rootCauseExplanation: null,
    };
    writeCase(tempCase);

    let runId: string | null = null;
    try {
      if (isSimulated) {
        // Simulated workflow test adapter: verifies multi-attempt state transitions
        const mockChecks: RequiredCheckResult[] = [
          {
            checkId: "check-typecheck",
            name: "TypeScript compilation",
            type: "typecheck",
            command: "tsc --noEmit",
            passed: true,
            exitCode: 0,
            durationMs: 320,
            output: "Found 0 errors",
          },
          {
            checkId: "check-build",
            name: "Production Vite build",
            type: "build",
            command: "vite build",
            passed: true,
            exitCode: 0,
            durationMs: 450,
            output: "built in 0.4s",
          },
          {
            checkId: "check-unit-tests",
            name: "MiniShop unit tests",
            type: "unit-tests",
            command: "vitest run apps/minishop",
            passed: true,
            exitCode: 0,
            durationMs: 250,
            output: "3 passed",
          },
        ];

        const mockDeps: Partial<RepairDependencies> = {
          startApp: async () => ({ port: 5210, url: "http://localhost:5210", process: {} as any }),
          stopApp: async () => {},
          run: async (_caseId, _file, phase) => ({
            passed: phase === "after",
            outcome: phase === "before" ? "ASSERTION_FAILED" : "PASSED",
            expected: "Expected value matches calculation",
            actual: phase === "before" ? "Defective value received" : "Expected value matches calculation",
            durationMs: 150,
            runId: `sim-eval-${phase}`,
            testFingerprint: testFingerprint(bCase.reproductionTest),
            testIds: [`${path.basename(bCase.reproductionTest)}:${bCase.title}:chromium`],
            reportHash: "sim-hash",
            artifactPaths: {},
            rawOutput: "",
          }),
          checks: async () => mockChecks,
          generate: async () => {
            const rawDefects = getCaseDefects(bCase);
            const edits = rawDefects.map((d) => ({
              relativePath: d.relativePath,
              oldContent: d.buggyContent,
              newContent: d.fixedContent,
            }));
            const hash = computeProposalHash(
              edits,
              bCase.diagnosis,
              `Fix defective logic in ${rawDefects.map((d) => d.relativePath).join(", ")}`
            );
            const diffs = rawDefects
              .map((d) => `--- ${d.relativePath}\n+++ ${d.relativePath}\n@@\n-${d.buggyContent}\n+${d.fixedContent}\n`)
              .join("\n");
            return {
              schemaVersion: "1.0",
              proposalId: `prop-sim-${bCase.id}`,
              diagnosis: bCase.diagnosis,
              assumptions: ["Standard MiniShop cart operations"],
              rationale: `Fix defective logic in ${rawDefects.map((d) => d.relativePath).join(", ")}`,
              edits,
              unifiedDiff: diffs,
              proposalHash: hash,
              proposedAt: new Date().toISOString(),
            };
          },
        };

        const run = await createAndStartRepairRun(
          bCase.id,
          {
            mode: "simulated",
            maxAttempts,
            seedDefects: getCaseDefects(bCase).map((d) => ({
              relativePath: d.relativePath,
              originalSnippet: d.fixedContent,
              defectiveSnippet: d.buggyContent,
            })),
          },
          mockDeps
        );
        runId = run.runId;

        if (run.state === "AWAITING_REVIEW" && run.proposal) {
          const verifiedRun = await reviewAndApplyRepairRun(
            run.runId,
            {
              proposalId: run.proposal.proposalId,
              proposalHash: run.proposal.proposalHash,
              decision: "APPROVED",
            },
            mockDeps
          );

          const durationMs = Date.now() - caseStart;
          const verified = verifiedRun.state === "VERIFIED";

          results.push({
            id: bCase.id,
            title: bCase.title,
            split: bCase.split,
            mode: "simulated",
            runId,
            provider: "simulated",
            model: "fixture",
            promptVersion: "v1.0",
            datasetHash,
            sourceFingerprint: verifiedRun.originalSourceFingerprint,
            artifactLinks: {
              runDir: `artifacts/runs/${runId}`,
            },
            baselineReproduction: "ASSERTION_FAILED",
            proposalGenerated: true,
            verified,
            state: verifiedRun.state,
            attemptsUsed: verifiedRun.attempt,
            allChecksPassed: verifiedRun.requiredChecks.every((c) => c.passed),
            durationMs,
            failureReasons: verifiedRun.diagnostics ?? [],
            tokenUsage: "unknown",
            estimatedCost: "unknown",
            stopReason: verifiedRun.stopReason,
            proposalDiff: verifiedRun.proposal?.unifiedDiff,
          });

          console.log(`  -> [SIMULATED] Verdict: ${verifiedRun.state} (Attempts: ${verifiedRun.attempt}, Duration: ${durationMs}ms)`);
        } else {
          const durationMs = Date.now() - caseStart;
          results.push({
            id: bCase.id,
            title: bCase.title,
            split: bCase.split,
            mode: "simulated",
            runId,
            provider: "simulated",
            model: "fixture",
            promptVersion: "v1.0",
            datasetHash,
            sourceFingerprint: run.originalSourceFingerprint,
            artifactLinks: {
              runDir: `artifacts/runs/${runId}`,
            },
            baselineReproduction: run.baselineRun?.outcome === "ASSERTION_FAILED" ? "ASSERTION_FAILED" : "ERROR",
            proposalGenerated: !!run.proposal,
            verified: false,
            state: run.state,
            attemptsUsed: run.attempt,
            allChecksPassed: false,
            durationMs,
            failureReasons: run.diagnostics ?? [],
            tokenUsage: "unknown",
            estimatedCost: "unknown",
            stopReason: run.stopReason,
          });
          console.log(`  -> [SIMULATED] Stopped in state: ${run.state} (${run.stopReason})`);
        }
      } else {
        // LIVE DYNAMIC EVALUATION PATH
        const run = await createAndStartRepairRun(bCase.id, {
          mode: "dynamic",
          maxAttempts,
          seedDefects: getCaseDefects(bCase).map((d) => ({
            relativePath: d.relativePath,
            originalSnippet: d.fixedContent,
            defectiveSnippet: d.buggyContent,
          })),
        });
        runId = run.runId;

        const baselineRep =
          run.baselineRun?.outcome === "ASSERTION_FAILED"
            ? "ASSERTION_FAILED"
            : run.baselineRun?.outcome === "PASSED"
            ? "PASSED"
            : "ERROR";

        if (run.state === "AWAITING_REVIEW" && run.proposal) {
          console.log(`  -> Baseline reproduced. Proposal generated: ${run.proposal.proposalId} (Hash: ${run.proposal.proposalHash.slice(0, 10)}...)`);
          console.log(`  -> Reviewing and applying candidate patch...`);

          const verifiedRun = await reviewAndApplyRepairRun(run.runId, {
            proposalId: run.proposal.proposalId,
            proposalHash: run.proposal.proposalHash,
            decision: "APPROVED",
            reviewerNotes: "Automated benchmark evaluation review",
          });

          const durationMs = Date.now() - caseStart;
          const verified = verifiedRun.state === "VERIFIED";

          results.push({
            id: bCase.id,
            title: bCase.title,
            split: bCase.split,
            mode: "live",
            runId,
            provider,
            model,
            promptVersion: "v1.0",
            datasetHash,
            sourceFingerprint: verifiedRun.originalSourceFingerprint,
            artifactLinks: {
              runDir: `artifacts/runs/${runId}`,
              baselineArtifacts: `artifacts/runs/${runId}/baseline`,
              verificationArtifacts: `artifacts/runs/${runId}/attempt-${verifiedRun.attempt}/verification`,
              checksArtifacts: `artifacts/runs/${runId}/attempt-${verifiedRun.attempt}/checks`,
            },
            baselineReproduction: baselineRep,
            proposalGenerated: true,
            verified,
            state: verifiedRun.state,
            attemptsUsed: verifiedRun.attempt,
            allChecksPassed: verifiedRun.requiredChecks.length > 0 && verifiedRun.requiredChecks.every((c) => c.passed),
            durationMs,
            failureReasons: verifiedRun.diagnostics ?? [],
            tokenUsage: verifiedRun.costEstimate?.totalTokens != null
              ? {
                  promptTokens: verifiedRun.costEstimate.promptTokens,
                  completionTokens: verifiedRun.costEstimate.completionTokens,
                  totalTokens: verifiedRun.costEstimate.totalTokens,
                }
              : "unknown",
            estimatedCost: verifiedRun.costEstimate?.estimatedCost ?? "unknown",
            stopReason: verifiedRun.stopReason,
            proposalDiff: verifiedRun.proposal?.unifiedDiff,
          });

          console.log(`  -> [LIVE] Verdict: ${verifiedRun.state} (Attempts: ${verifiedRun.attempt}, Duration: ${durationMs}ms)`);
        } else {
          const durationMs = Date.now() - caseStart;
          results.push({
            id: bCase.id,
            title: bCase.title,
            split: bCase.split,
            mode: "live",
            runId,
            provider,
            model,
            promptVersion: "v1.0",
            datasetHash,
            sourceFingerprint: run.originalSourceFingerprint,
            artifactLinks: {
              runDir: `artifacts/runs/${runId}`,
              baselineArtifacts: `artifacts/runs/${runId}/baseline`,
            },
            baselineReproduction: baselineRep,
            proposalGenerated: !!run.proposal,
            verified: false,
            state: run.state,
            attemptsUsed: run.attempt,
            allChecksPassed: false,
            durationMs,
            failureReasons: run.diagnostics ?? [],
            tokenUsage: run.costEstimate?.totalTokens != null
              ? {
                  promptTokens: run.costEstimate.promptTokens,
                  completionTokens: run.costEstimate.completionTokens,
                  totalTokens: run.costEstimate.totalTokens,
                }
              : "unknown",
            estimatedCost: run.costEstimate?.estimatedCost ?? "unknown",
            stopReason: run.stopReason,
            error: run.error,
          });
          console.log(`  -> [LIVE] Stopped in state: ${run.state} (${run.stopReason ?? run.error})`);
        }
      }
    } catch (err: any) {
      const durationMs = Date.now() - caseStart;
      results.push({
        id: bCase.id,
        title: bCase.title,
        split: bCase.split,
        mode: isSimulated ? "simulated" : "live",
        runId,
        provider,
        model,
        promptVersion: "v1.0",
        datasetHash,
        baselineReproduction: "ERROR",
        proposalGenerated: false,
        verified: false,
        state: "BLOCKED",
        attemptsUsed: 1,
        allChecksPassed: false,
        durationMs,
        failureReasons: [err instanceof Error ? err.message : String(err)],
        tokenUsage: "unknown",
        estimatedCost: "unknown",
        stopReason: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`  -> Error executing case ${bCase.id}: ${err.message}`);
    } finally {
      if (priorCase) {
        writeCase(priorCase);
      } else {
        deleteCase(bCase.id);
      }
    }
  }

  const totalDuration = Date.now() - startAll;
  const verifiedCount = results.filter((r) => r.verified).length;
  const heldOutCases = results.filter((r) => r.split === "held-out");
  const heldOutVerified = heldOutCases.filter((r) => r.verified).length;
  const devCases = results.filter((r) => r.split === "dev");
  const devVerified = devCases.filter((r) => r.verified).length;
  const singleAttemptPasses = results.filter((r) => r.verified && r.attemptsUsed === 1).length;
  const baselineReproduced = results.filter((r) => r.baselineReproduction === "ASSERTION_FAILED").length;
  const proposalsGenerated = results.filter((r) => r.proposalGenerated).length;
  const allChecksPassedCount = results.filter((r) => r.allChecksPassed).length;

  const summary = {
    evaluatedAt: new Date().toISOString(),
    mode: isSimulated ? "simulated-fixture" : "live-dynamic",
    provider,
    model,
    datasetHash,
    totalCases: results.length,
    baselineReproducedCount: baselineReproduced,
    baselineReproductionDenominator: results.length,
    baselineReproductionRate: Number(((baselineReproduced / results.length) * 100).toFixed(1)),
    proposalsGeneratedCount: proposalsGenerated,
    proposalsGeneratedDenominator: results.length,
    proposalsGeneratedRate: Number(((proposalsGenerated / results.length) * 100).toFixed(1)),
    verifiedCount,
    verifiedDenominator: results.length,
    verifiedRate: Number(((verifiedCount / results.length) * 100).toFixed(1)),
    devTotal: devCases.length,
    devVerified,
    devVerifiedRate: devCases.length > 0 ? Number(((devVerified / devCases.length) * 100).toFixed(1)) : 0,
    heldOutTotal: heldOutCases.length,
    heldOutVerified,
    heldOutVerifiedRate:
      heldOutCases.length > 0 ? Number(((heldOutVerified / heldOutCases.length) * 100).toFixed(1)) : 0,
    singleAttemptPassCount: singleAttemptPasses,
    singleAttemptPassDenominator: results.length,
    singleAttemptPassRate:
      results.length > 0 ? Number(((singleAttemptPasses / results.length) * 100).toFixed(1)) : 0,
    allChecksPassedCount,
    allChecksPassedDenominator: results.length,
    allChecksPassedRate: Number(((allChecksPassedCount / results.length) * 100).toFixed(1)),
    totalDurationMs: totalDuration,
    avgDurationPerCaseMs: Math.round(totalDuration / results.length),
  };

  const reportPayload = {
    mode: isSimulated ? "SIMULATED_FIXTURE_HARNESS" : "LIVE_DYNAMIC_REPAIR",
    disclaimer: isSimulated
      ? "SIMULATED HARNESS: Tests state machine and isolation contracts using synthetic fixtures. Does NOT represent real LLM accuracy or benchmark proof."
      : "LIVE BENCHMARK: Executed with real model proposals, isolated browser runs, and regression checks.",
    summary,
    results,
  };

  const reportArtifact = path.join(ARTIFACTS_DIR, "repair-evaluation-report.json");
  const nestedReportArtifact = path.join(evalArtifactsDir, "repair-evaluation-report.json");
  fs.writeFileSync(reportArtifact, JSON.stringify(reportPayload, null, 2));
  fs.writeFileSync(nestedReportArtifact, JSON.stringify(reportPayload, null, 2));

  console.log(`\n========================================================================`);
  if (isSimulated) {
    console.log(` Simulated Fixture Harness Results (Synthetic State Machine Test) `);
  } else {
    console.log(` Live AI Repair Benchmark Results `);
  }
  console.log(`========================================================================`);
  console.log(`Total Cases Evaluated:       ${summary.totalCases}`);
  console.log(`Baseline Reproduction Rate:  ${summary.baselineReproductionRate}% (${baselineReproduced}/${results.length})`);
  console.log(`Proposal Generation Rate:    ${summary.proposalsGeneratedRate}% (${proposalsGenerated}/${results.length})`);
  console.log(`Overall Verified Repair Rate: ${summary.verifiedRate}% (${verifiedCount}/${results.length})`);
  console.log(`Dev Cases Verified:          ${summary.devVerifiedRate}% (${devVerified}/${devCases.length})`);
  console.log(`Held-out Cases Verified:     ${summary.heldOutVerifiedRate}% (${heldOutVerified}/${heldOutCases.length})`);
  console.log(`Single-Attempt Pass Rate:    ${summary.singleAttemptPassRate}% (${singleAttemptPasses}/${results.length})`);
  console.log(`Regression-Free Rate:        ${summary.allChecksPassedRate}% (${allChecksPassedCount}/${results.length})`);
  console.log(`Total Evaluation Time:       ${(totalDuration / 1000).toFixed(2)}s\n`);
  console.log(`Full report saved to: ${reportArtifact}\n`);
}

main().catch((err) => {
  console.error("Repair evaluation benchmark failed:", err);
  process.exitCode = 1;
});
