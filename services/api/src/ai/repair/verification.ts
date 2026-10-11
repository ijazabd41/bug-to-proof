import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { WORKSPACE_ROOT } from "../../utils/paths";
import { computeSourceManifest, terminateProcessTree } from "./workspace";
import { registerChildProcess, unregisterChildProcess } from "./runtimeRegistry";
import type { RequiredCheckResult, ModelProposal, ProposalReview } from "./contracts";
import { computeProposalHash } from "./contracts";

export interface CheckExecutionOptions {
  cwd: string;
  command: string;
  args: string[];
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  runId?: string;
  abortSignal?: AbortSignal;
}

export function executeCheck(options: CheckExecutionOptions): Promise<{
  exitCode: number | null;
  output: string;
  durationMs: number;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    let output = "";
    let settled = false;

    if (options.abortSignal?.aborted) {
      resolve({
        exitCode: -1,
        output: "[Check aborted before start]",
        durationMs: 0,
      });
      return;
    }

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      shell: false,
      env: { ...process.env, CI: "true", ...options.env },
    });

    if (options.runId) {
      registerChildProcess(options.runId, child);
    }

    const cleanup = () => {
      if (options.runId) {
        unregisterChildProcess(options.runId, child);
      }
    };

    let abortListener: (() => void) | undefined;
    if (options.abortSignal) {
      abortListener = async () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          cleanup();
          await terminateProcessTree(child);
          resolve({
            exitCode: -1,
            output: output + "\n[Check aborted by signal]",
            durationMs: Date.now() - start,
          });
        }
      };
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }

    const timeout = setTimeout(async () => {
      if (!settled) {
        settled = true;
        cleanup();
        await terminateProcessTree(child);
        resolve({
          exitCode: -1,
          output: output + "\n[Check exceeded timeout limit]",
          durationMs: Date.now() - start,
        });
      }
    }, options.timeoutMs ?? 60_000);

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        cleanup();
        resolve({
          exitCode: -1,
          output: output + `\n[Spawn error: ${err.message}]`,
          durationMs: Date.now() - start,
        });
      }
    });

    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        cleanup();
        resolve({
          exitCode: code,
          output,
          durationMs: Date.now() - start,
        });
      }
    });
  });
}

export async function runRequiredChecks(
  minishopDir: string,
  runArtifactDir: string,
  options?: { runId?: string; abortSignal?: AbortSignal }
): Promise<RequiredCheckResult[]> {
  if (options?.abortSignal?.aborted) {
    throw new Error("Regression checks aborted by signal");
  }

  const checksDir = path.join(runArtifactDir, "checks");
  if (!fs.existsSync(checksDir)) {
    fs.mkdirSync(checksDir, { recursive: true });
  }

  // Record candidate source fingerprint before running regression checks
  const { fingerprint: beforeFingerprint } = computeSourceManifest(minishopDir);

  const results: RequiredCheckResult[] = [];
  const minishopTsConfig = path.join(minishopDir, "tsconfig.json");
  const minishopViteConfig = path.join(minishopDir, "vite.config.ts");
  const tscCli = path.join(WORKSPACE_ROOT, "node_modules", "typescript", "bin", "tsc");
  const viteCli = path.join(WORKSPACE_ROOT, "node_modules", "vite", "bin", "vite.js");
  const vitestCli = path.join(WORKSPACE_ROOT, "node_modules", "vitest", "vitest.mjs");

  // Check 1: TypeScript typecheck against candidate workspace
  const typecheckExec = await executeCheck({
    cwd: WORKSPACE_ROOT,
    command: process.execPath,
    args: [tscCli, "--project", minishopTsConfig, "--noEmit"],
    timeoutMs: 30_000,
    runId: options?.runId,
    abortSignal: options?.abortSignal,
  });

  const typecheckPassed = typecheckExec.exitCode === 0;
  fs.writeFileSync(path.join(checksDir, "typecheck.log"), typecheckExec.output);

  results.push({
    checkId: "check-typecheck",
    name: "TypeScript compilation",
    type: "typecheck",
    command: `tsc --project ${path.relative(WORKSPACE_ROOT, minishopTsConfig).replace(/\\/g, "/")} --noEmit`,
    passed: typecheckPassed,
    exitCode: typecheckExec.exitCode,
    durationMs: typecheckExec.durationMs,
    output: typecheckExec.output,
    artifactPath: path.relative(WORKSPACE_ROOT, path.join(checksDir, "typecheck.log")).replace(/\\/g, "/"),
  });

  if (options?.abortSignal?.aborted) {
    throw new Error("Regression checks aborted by signal");
  }

  // Check 2: Production Vite build against candidate workspace
  const buildExec = await executeCheck({
    cwd: WORKSPACE_ROOT,
    command: process.execPath,
    args: [viteCli, "build", minishopDir, "--config", minishopViteConfig],
    timeoutMs: 45_000,
    runId: options?.runId,
    abortSignal: options?.abortSignal,
  });

  const buildPassed = buildExec.exitCode === 0;
  fs.writeFileSync(path.join(checksDir, "build.log"), buildExec.output);

  results.push({
    checkId: "check-build",
    name: "Production Vite build",
    type: "build",
    command: `vite build ${path.relative(WORKSPACE_ROOT, minishopDir).replace(/\\/g, "/")} --config ${path.relative(WORKSPACE_ROOT, minishopViteConfig).replace(/\\/g, "/")}`,
    passed: buildPassed,
    exitCode: buildExec.exitCode,
    durationMs: buildExec.durationMs,
    output: buildExec.output,
    artifactPath: path.relative(WORKSPACE_ROOT, path.join(checksDir, "build.log")).replace(/\\/g, "/"),
  });

  if (options?.abortSignal?.aborted) {
    throw new Error("Regression checks aborted by signal");
  }

  // Check 3: MiniShop unit tests against candidate workspace
  const unitExec = await executeCheck({
    cwd: minishopDir,
    command: process.execPath,
    args: [vitestCli, "run", "--no-file-parallelism"],
    timeoutMs: 45_000,
    runId: options?.runId,
    abortSignal: options?.abortSignal,
  });

  const unitPassed = unitExec.exitCode === 0;
  fs.writeFileSync(path.join(checksDir, "unit-tests.log"), unitExec.output);

  results.push({
    checkId: "check-unit-tests",
    name: "MiniShop unit tests",
    type: "unit-tests",
    command: `vitest run --no-file-parallelism (in ${path.relative(WORKSPACE_ROOT, minishopDir).replace(/\\/g, "/")})`,
    passed: unitPassed,
    exitCode: unitExec.exitCode,
    durationMs: unitExec.durationMs,
    output: unitExec.output,
    artifactPath: path.relative(WORKSPACE_ROOT, path.join(checksDir, "unit-tests.log")).replace(/\\/g, "/"),
  });

  // Verify candidate source was not mutated during checks
  const { fingerprint: afterFingerprint } = computeSourceManifest(minishopDir);
  if (beforeFingerprint !== afterFingerprint) {
    throw new Error(
      `Candidate source integrity violation: source fingerprint changed during regression checks (before: ${beforeFingerprint}, after: ${afterFingerprint})`
    );
  }

  // Validate all required checks are present
  const requiredTypes = ["typecheck", "build", "unit-tests"];
  for (const reqType of requiredTypes) {
    if (!results.some((r) => r.type === reqType)) {
      throw new Error(`Missing required check: ${reqType}`);
    }
  }

  return results;
}

import type { TestRun } from "@bug-to-proof/shared-types";
import { testFingerprint, digest } from "../../runner/integrity";
import { classifyReport } from "../../runner/classification";

export interface BaselineGateInputs {
  caseId: string;
  reproductionTestFile: string;
  testFingerprint: string;
  baselineRun: TestRun | null | undefined;
  baselineArtifactDir?: string;
  mode?: "dynamic" | "simulated";
}

export interface VerificationGateInputs {
  caseId: string;
  reproductionTestFile: string;
  testFingerprint: string;
  baselineRun: TestRun | null | undefined;
  postPatchRun: TestRun | null | undefined;
  requiredChecks: RequiredCheckResult[];
  proposal?: ModelProposal | null;
  review?: ProposalReview | null;
  candidateMinishopDir?: string;
  candidateFingerprint?: string;
  baselineArtifactDir?: string;
  postPatchArtifactDir?: string;
  mode?: "dynamic" | "simulated";
}

export interface VerificationGateResult {
  verified: boolean;
  violations: string[];
}

/**
 * Validates baseline reproduction gates before patch proposal or application.
 */
export function validateBaselineGates(inputs: BaselineGateInputs): VerificationGateResult {
  const violations: string[] = [];
  const isSimulated = inputs.mode === "simulated";

  if (!inputs.baselineRun) {
    violations.push("Missing baseline reproduction run record");
    return { verified: false, violations };
  }

  if (inputs.baselineRun.outcome !== "ASSERTION_FAILED") {
    violations.push(`Baseline outcome was '${inputs.baselineRun.outcome}', expected 'ASSERTION_FAILED'`);
  }
  if (!inputs.baselineRun.reportHash || typeof inputs.baselineRun.reportHash !== "string" || inputs.baselineRun.reportHash.trim() === "") {
    violations.push("Baseline report hash is missing or empty");
  }
  if (!inputs.baselineRun.testFingerprint || typeof inputs.baselineRun.testFingerprint !== "string" || inputs.baselineRun.testFingerprint.trim() === "") {
    violations.push("Baseline test fingerprint is missing or empty");
  }

  // Disk evidence validation
  if (!isSimulated && !inputs.baselineArtifactDir) {
    violations.push("Baseline artifact directory path is missing in dynamic mode");
  } else if (inputs.baselineArtifactDir) {
    const manifestPath = path.join(inputs.baselineArtifactDir, "manifest.json");
    const resultJsonPath = path.join(inputs.baselineArtifactDir, "result.json");
    const hasAnyArtifact = fs.existsSync(manifestPath) || fs.existsSync(resultJsonPath);

    if (!isSimulated || hasAnyArtifact) {
      if (!fs.existsSync(manifestPath)) {
        violations.push(`Baseline manifest not found at ${manifestPath}`);
      }
      if (!fs.existsSync(resultJsonPath)) {
        violations.push(`Baseline report (result.json) not found at ${resultJsonPath}`);
      }

      if (fs.existsSync(manifestPath) && fs.existsSync(resultJsonPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          const resultJsonRaw = fs.readFileSync(resultJsonPath, "utf-8");
          const recomputedHash = digest(resultJsonRaw);

          if (inputs.baselineRun.reportHash && recomputedHash !== inputs.baselineRun.reportHash) {
            violations.push(
              `Baseline report hash mismatch on disk: recomputed ${recomputedHash} vs recorded ${inputs.baselineRun.reportHash}`
            );
          }

          if (manifest.reportHash !== inputs.baselineRun.reportHash) {
            violations.push(
              `Baseline manifest reportHash (${manifest.reportHash}) does not match recorded run (${inputs.baselineRun.reportHash})`
            );
          }

          if (manifest.runId && inputs.baselineRun.runId && manifest.runId !== inputs.baselineRun.runId) {
            violations.push(
              `Baseline manifest runId (${manifest.runId}) does not match recorded run (${inputs.baselineRun.runId})`
            );
          }

          if (manifest.outcome !== "ASSERTION_FAILED") {
            violations.push(`Baseline manifest outcome is '${manifest.outcome}', expected 'ASSERTION_FAILED'`);
          }

          const parsedReport = JSON.parse(resultJsonRaw);
          const reclassified = classifyReport(parsedReport, manifest.exitCode ?? 1);
          if (reclassified.outcome !== "ASSERTION_FAILED") {
            violations.push(
              `Baseline result.json reclassification yielded '${reclassified.outcome}', expected 'ASSERTION_FAILED'`
            );
          }
        } catch (err: any) {
          violations.push(`Failed to parse or validate baseline evidence artifacts: ${err.message}`);
        }
      }
    }
  }

  // Reproduction test fingerprint validation
  let currentTestFp = "";
  try {
    currentTestFp = testFingerprint(inputs.reproductionTestFile);
  } catch (err: any) {
    violations.push(`Failed to compute current reproduction test fingerprint: ${err.message}`);
  }

  if (inputs.baselineRun.testFingerprint && currentTestFp && inputs.baselineRun.testFingerprint !== currentTestFp) {
    violations.push(
      `Baseline test fingerprint (${inputs.baselineRun.testFingerprint}) does not match current disk test (${currentTestFp})`
    );
  }

  if (inputs.testFingerprint && currentTestFp && inputs.testFingerprint !== currentTestFp) {
    violations.push(
      `Reproduction test inputs changed: recorded ${inputs.testFingerprint} vs current disk ${currentTestFp}`
    );
  }

  return {
    verified: violations.length === 0,
    violations,
  };
}

/**
 * Centralized verification gate enforcer.
 * Requires:
 * 1. Valid recorded baseline assertion failure with non-empty report hash and matching disk evidence.
 * 2. Passing unchanged reproduction with valid report hash and matching disk evidence.
 * 3. Exact matching test fingerprints across baseline, disk, and post-patch runs.
 * 4. Non-empty executed test identities corresponding to configured reproduction spec, matching before/after.
 * 5. 100% passing results across all policy-required regression checks.
 * 6. Valid candidate workspace binding.
 * 7. Canonical proposal hash verification and exact approval binding.
 */
export function validateVerificationGates(inputs: VerificationGateInputs): VerificationGateResult {
  const violations: string[] = [];
  const isSimulated = inputs.mode === "simulated";

  // 1. Validate Baseline Gates
  const baseCheck = validateBaselineGates({
    caseId: inputs.caseId,
    reproductionTestFile: inputs.reproductionTestFile,
    testFingerprint: inputs.testFingerprint,
    baselineRun: inputs.baselineRun,
    baselineArtifactDir: inputs.baselineArtifactDir,
    mode: inputs.mode,
  });
  violations.push(...baseCheck.violations);

  // 2. Validate Proposal Canonical Hash and Review Approval Binding
  if (inputs.proposal) {
    const recomputedHash = computeProposalHash(
      inputs.proposal.edits,
      inputs.proposal.diagnosis,
      inputs.proposal.rationale
    );
    if (recomputedHash !== inputs.proposal.proposalHash) {
      violations.push(
        `Proposal hash mismatch: recomputed ${recomputedHash} vs stored ${inputs.proposal.proposalHash}`
      );
    }
  }

  if (inputs.review) {
    if (inputs.review.decision !== "APPROVED") {
      violations.push(`Proposal review decision is '${inputs.review.decision}', expected 'APPROVED'`);
    }
    if (inputs.proposal) {
      if (inputs.review.proposalId !== inputs.proposal.proposalId) {
        violations.push(
          `Review proposal ID '${inputs.review.proposalId}' does not match proposal '${inputs.proposal.proposalId}'`
        );
      }
      if (inputs.review.proposalHash !== inputs.proposal.proposalHash) {
        violations.push(
          `Review proposal hash '${inputs.review.proposalHash}' does not match proposal '${inputs.proposal.proposalHash}'`
        );
      }
    }
  }

  // 3. Passing unchanged reproduction in memory
  if (!inputs.postPatchRun) {
    violations.push("Missing post-patch reproduction run record");
  } else {
    if (inputs.postPatchRun.outcome !== "PASSED" || inputs.postPatchRun.passed !== true) {
      violations.push(
        `Post-patch reproduction outcome was '${inputs.postPatchRun.outcome}' (passed: ${inputs.postPatchRun.passed}), expected 'PASSED'`
      );
    }
    if (!inputs.postPatchRun.reportHash || typeof inputs.postPatchRun.reportHash !== "string" || inputs.postPatchRun.reportHash.trim() === "") {
      violations.push("Post-patch report hash is missing or empty");
    }
    if (!inputs.postPatchRun.testFingerprint || typeof inputs.postPatchRun.testFingerprint !== "string" || inputs.postPatchRun.testFingerprint.trim() === "") {
      violations.push("Post-patch test fingerprint is missing or empty");
    }
  }

  // 3. Validate post-patch saved evidence artifacts on disk
  if (!isSimulated && !inputs.postPatchArtifactDir) {
    violations.push("Post-patch artifact directory path is missing in dynamic mode");
  } else if (inputs.postPatchArtifactDir) {
    const manifestPath = path.join(inputs.postPatchArtifactDir, "manifest.json");
    const resultJsonPath = path.join(inputs.postPatchArtifactDir, "result.json");
    const hasAnyArtifact = fs.existsSync(manifestPath) || fs.existsSync(resultJsonPath);

    if (!isSimulated || hasAnyArtifact) {
      if (!fs.existsSync(manifestPath)) {
        violations.push(`Post-patch manifest not found at ${manifestPath}`);
      }
      if (!fs.existsSync(resultJsonPath)) {
        violations.push(`Post-patch report (result.json) not found at ${resultJsonPath}`);
      }

      if (fs.existsSync(manifestPath) && fs.existsSync(resultJsonPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          const resultJsonRaw = fs.readFileSync(resultJsonPath, "utf-8");
          const recomputedHash = digest(resultJsonRaw);

          if (inputs.postPatchRun?.reportHash && recomputedHash !== inputs.postPatchRun.reportHash) {
            violations.push(
              `Post-patch report hash mismatch on disk: recomputed ${recomputedHash} vs recorded ${inputs.postPatchRun.reportHash}`
            );
          }

          if (manifest.reportHash !== inputs.postPatchRun?.reportHash) {
            violations.push(
              `Post-patch manifest reportHash (${manifest.reportHash}) does not match recorded run (${inputs.postPatchRun?.reportHash})`
            );
          }

          if (manifest.runId && inputs.postPatchRun?.runId && manifest.runId !== inputs.postPatchRun.runId) {
            violations.push(
              `Post-patch manifest runId (${manifest.runId}) does not match recorded run (${inputs.postPatchRun.runId})`
            );
          }

          if (manifest.outcome !== "PASSED" || manifest.passed !== true) {
            violations.push(`Post-patch manifest outcome is '${manifest.outcome}', expected 'PASSED'`);
          }

          const parsedReport = JSON.parse(resultJsonRaw);
          const reclassified = classifyReport(parsedReport, manifest.exitCode ?? 0);
          if (reclassified.outcome !== "PASSED") {
            violations.push(
              `Post-patch result.json reclassification yielded '${reclassified.outcome}', expected 'PASSED'`
            );
          }
        } catch (err: any) {
          violations.push(`Failed to parse or validate post-patch evidence artifacts: ${err.message}`);
        }
      }
    }
  }

  // 4. Matching baseline, current, and post-patch test inputs (fingerprints)
  let currentTestFp = "";
  try {
    currentTestFp = testFingerprint(inputs.reproductionTestFile);
  } catch (err: any) {
    violations.push(`Failed to compute current reproduction test fingerprint: ${err.message}`);
  }

  if (inputs.postPatchRun?.testFingerprint && currentTestFp && inputs.postPatchRun.testFingerprint !== currentTestFp) {
    violations.push(
      `Post-patch test fingerprint (${inputs.postPatchRun.testFingerprint}) does not match current disk test (${currentTestFp})`
    );
  }

  if (
    inputs.baselineRun?.testFingerprint &&
    inputs.postPatchRun?.testFingerprint &&
    inputs.baselineRun.testFingerprint !== inputs.postPatchRun.testFingerprint
  ) {
    violations.push("Baseline and post-patch test fingerprints do not match");
  }

  // 5. Matching executed test identities bound to reproduction spec
  if (inputs.baselineRun && inputs.postPatchRun) {
    const baseIds = [...(inputs.baselineRun.testIds || [])].sort();
    const postIds = [...(inputs.postPatchRun.testIds || [])].sort();

    if (baseIds.length === 0) {
      violations.push("Baseline executed test identities list is empty");
    }
    if (postIds.length === 0) {
      violations.push("Post-patch executed test identities list is empty");
    }
    if (JSON.stringify(baseIds) !== JSON.stringify(postIds)) {
      violations.push(
        `Executed test identities mismatch: baseline [${baseIds.join(", ")}] vs post-patch [${postIds.join(", ")}]`
      );
    }

    const expectedSpecBasename = path.basename(inputs.reproductionTestFile);
    for (const id of baseIds) {
      const specPart = id.split(":")[0];
      const specBasename = path.basename(specPart);
      if (specBasename !== expectedSpecBasename) {
        violations.push(
          `Executed test identity '${id}' does not correspond to configured reproduction spec '${inputs.reproductionTestFile}'`
        );
      }
    }
  }

  // 6. Every policy-required regression check passing against candidate source
  const requiredTypes = ["typecheck", "build", "unit-tests"];
  for (const reqType of requiredTypes) {
    const found = inputs.requiredChecks.find((c) => c.type === reqType);
    if (!found) {
      violations.push(`Missing required regression check: '${reqType}'`);
    } else if (!found.passed || found.exitCode !== 0) {
      violations.push(`Required check '${found.name}' failed with exit code ${found.exitCode}`);
    } else if (found.artifactPath) {
      const fullLogPath = path.resolve(WORKSPACE_ROOT, found.artifactPath);
      if (!fs.existsSync(fullLogPath)) {
        violations.push(`Regression check log missing at ${found.artifactPath}`);
      }
    }
  }

  // 7. Validate candidate workspace binding if candidate directory or fingerprint provided
  if (inputs.candidateMinishopDir && fs.existsSync(inputs.candidateMinishopDir)) {
    const currentCandidateManifest = computeSourceManifest(inputs.candidateMinishopDir);
    if (inputs.candidateFingerprint && currentCandidateManifest.fingerprint !== inputs.candidateFingerprint) {
      violations.push(
        `Candidate source fingerprint mismatch: computed ${currentCandidateManifest.fingerprint} vs expected ${inputs.candidateFingerprint}`
      );
    }
  }

  return {
    verified: violations.length === 0,
    violations,
  };
}
