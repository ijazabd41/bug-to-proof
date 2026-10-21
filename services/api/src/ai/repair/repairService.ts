import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { Command } from "@langchain/langgraph";
import { readCase } from "../../storage/caseStore";
import { testFingerprint } from "../../runner/integrity";
import { generatedTestFingerprint } from "../../runner/playwrightRunner";
import { ARTIFACTS_DIR, WORKSPACE_ROOT } from "../../utils/paths";
import type {
  RepairRunRecord,
  RepairRunConfig,
  ProposalReview,
  RunInputs,
} from "./contracts";
import {
  saveRunRecord,
  getRunRecord,
  listRunRecords,
  appendRunEvent,
} from "./runStore";
import {
  buildRepairGraph,
  RepairGraphDependencies,
} from "./repairGraph";
import {
  releaseWorkspaceLock,
  RunWorkspace,
} from "./workspace";
import {
  registerRunController,
  cleanupRunResources,
} from "./runtimeRegistry";

export type { RepairDependencies } from "./repairGraph";

const activeReviewLocks = new Set<string>();
const activeRunControllers = new Map<string, AbortController>();

/**
 * Persists an initial repair run record promptly (<50ms) with state INITIALIZING
 * and returns the generated run ID and record before graph execution.
 */
export function createRepairRunRecord(
  caseId: string,
  config?: RepairRunConfig
): RepairRunRecord {
  const bugCase = readCase(caseId);
  if (!bugCase) {
    throw new Error(`Case not found: ${caseId}`);
  }
  if (!bugCase.reproduction?.testFile) {
    throw new Error(`Case ${caseId} does not have a configured reproduction test`);
  }

  const runId = `run-${randomUUID()}`;
  const reproductionTestFile = bugCase.reproduction.testFile;
  const reproductionTestRoot = bugCase.reproduction.testRoot;
  const fp = reproductionTestRoot ? generatedTestFingerprint(reproductionTestFile) : testFingerprint(reproductionTestFile);

  let reproductionTestContent = "";
  try {
    const resolvedTestPath = path.resolve(WORKSPACE_ROOT, reproductionTestFile);
    if (fs.existsSync(resolvedTestPath)) {
      reproductionTestContent = fs.readFileSync(resolvedTestPath, "utf-8");
    }
  } catch {}

  const inputs: RunInputs = {
    caseSnapshot: JSON.parse(JSON.stringify(bugCase)),
    reproductionTest: {
      filePath: reproductionTestFile,
      root: reproductionTestRoot,
      content: reproductionTestContent,
      fingerprint: fp,
      provenance: bugCase.reproduction.generatedTest,
    },
  };

  const initialRecord: RepairRunRecord = {
    schemaVersion: "1.0",
    runId,
    caseId,
    mode: config?.mode ?? "dynamic",
    state: "INITIALIZING",
    attempt: 1,
    maxAttempts: config?.maxAttempts ?? 3,
    originalSourceFingerprint: "",
    targetSnapshotDir: "",
    reproductionTestFile,
    reproductionTestRoot,
    testFingerprint: fp,
    inputs,
    pricingConfig: config?.pricingConfig,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: [],
    diagnostics: [],
    requiredChecks: [],
    events: [
      {
        timestamp: new Date().toISOString(),
        stage: "initialization",
        message: "Repair run initialized and queued for background execution",
      },
    ],
  };

  saveRunRecord(initialRecord);
  return initialRecord;
}

/**
 * Executes a previously created repair run through LangGraph.
 */
export async function executeRepairRun(
  runId: string,
  deps: Partial<RepairGraphDependencies> = {},
  config?: RepairRunConfig
): Promise<RepairRunRecord> {
  const record = getRunRecord(runId);
  if (!record) {
    throw new Error(`Repair run not found: ${runId}`);
  }
  if (record.state === "CANCELLED") {
    return record;
  }

  const bugCase = readCase(record.caseId);
  if (!bugCase) {
    throw new Error(`Case not found: ${record.caseId}`);
  }

  const reproductionTestFile = record.reproductionTestFile || bugCase.reproduction?.testFile || "";
  const reproductionTestRoot = record.reproductionTestRoot || bugCase.reproduction?.testRoot;
  const fp = record.testFingerprint || (reproductionTestRoot ? generatedTestFingerprint(reproductionTestFile) : testFingerprint(reproductionTestFile));
  const startTime = Date.now();
  const deadlineMs = config?.timeoutMs ? startTime + config.timeoutMs : null;

  const controller = new AbortController();
  activeRunControllers.set(runId, controller);
  registerRunController(runId, controller);

  const graph = buildRepairGraph(deps);

  try {
    await graph.invoke(
      {
        runId,
        caseId: record.caseId,
        caseTitle: bugCase.title,
        caseDescription: bugCase.description,
        reproductionTestFile,
        reproductionTestRoot,
        testFingerprint: fp,
        config: config ?? { mode: record.mode, maxAttempts: record.maxAttempts },
        deadlineMs,
        state: record.state,
        attempt: record.attempt,
        maxAttempts: record.maxAttempts,
        attempts: record.attempts,
        diagnostics: record.diagnostics,
        requiredChecks: record.requiredChecks,
        events: [],
      },
      {
        configurable: { thread_id: runId },
        signal: controller.signal,
      }
    );
  } catch (err: any) {
    const existing = getRunRecord(runId);
    if (existing && existing.state !== "BLOCKED" && existing.state !== "CANCELLED") {
      existing.state = controller.signal.aborted ? "CANCELLED" : "BLOCKED";
      existing.error = err instanceof Error ? err.message : String(err);
      existing.completedAt = new Date().toISOString();
      saveRunRecord(existing);
    }
    await cleanupRunResources(runId, err instanceof Error ? err.message : String(err));
  } finally {
    activeRunControllers.delete(runId);
  }

  const finalRecord = getRunRecord(runId);
  if (!finalRecord) {
    throw new Error(`Failed to retrieve created run record for ${runId}`);
  }

  return finalRecord;
}

/**
 * Creates and starts a new dynamic AI repair run, orchestrating execution through LangGraph.
 * Executes the graph up to the human review pause (AWAITING_REVIEW) or blocked baseline.
 */
export async function createAndStartRepairRun(
  caseId: string,
  config?: RepairRunConfig,
  deps: Partial<RepairGraphDependencies> = {}
): Promise<RepairRunRecord> {
  const initial = createRepairRunRecord(caseId, config);
  return await executeRepairRun(initial.runId, deps, config);
}

/**
 * Resumes an AWAITING_REVIEW run through LangGraph, applying the exact approved patch
 * and executing post-patch reproduction and candidate regression checks.
 */
export async function reviewAndApplyRepairRun(
  runId: string,
  review: ProposalReview,
  deps: Partial<RepairGraphDependencies> = {}
): Promise<RepairRunRecord> {
  if (activeReviewLocks.has(runId)) {
    throw new Error(`A review operation is already in progress for run ${runId}`);
  }
  activeReviewLocks.add(runId);

  const controller = new AbortController();
  activeRunControllers.set(runId, controller);
  registerRunController(runId, controller);

  try {
    const current = getRunRecord(runId);
    if (!current) {
      throw new Error(`Repair run not found: ${runId}`);
    }

    if (current.state === "CANCELLED") {
      throw new Error("Cannot review or apply a cancelled repair run");
    }

    if (current.state !== "AWAITING_REVIEW") {
      throw new Error(`Cannot review run in state ${current.state}. Must be in AWAITING_REVIEW.`);
    }

    if (!current.proposal) {
      throw new Error("Cannot review run: No proposal exists on this run.");
    }

    if (review.proposalId !== current.proposal.proposalId) {
      throw new Error(
        `Exact approval binding failed: review proposalId (${review.proposalId}) does not match current proposal (${current.proposal.proposalId})`
      );
    }

    if (review.proposalHash !== current.proposal.proposalHash) {
      throw new Error(
        `Exact approval binding failed: review proposalHash (${review.proposalHash}) does not match current proposal (${current.proposal.proposalHash})`
      );
    }

    const graph = buildRepairGraph(deps);

    await graph.invoke(
      new Command({ resume: review }),
      {
        configurable: { thread_id: runId },
        signal: controller.signal,
      }
    );

    const updatedRecord = getRunRecord(runId);
    if (!updatedRecord) {
      throw new Error(`Failed to retrieve updated run record for ${runId}`);
    }

    return updatedRecord;
  } catch (err: any) {
    await cleanupRunResources(runId, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    activeReviewLocks.delete(runId);
    activeRunControllers.delete(runId);
  }
}

/**
 * Cancels an active or paused repair run, terminating associated child processes and releasing locks.
 */
export async function cancelRepairRun(
  runId: string,
  reason?: string,
  deps?: Partial<RepairGraphDependencies>
): Promise<RepairRunRecord> {
  const current = getRunRecord(runId);
  if (!current) {
    throw new Error(`Repair run not found: ${runId}`);
  }

  if (current.completedAt || current.state === "VERIFIED" || current.state === "CANCELLED") {
    return current;
  }

  // 1. Mark run as CANCELLED immediately to prevent race conditions
  current.state = "CANCELLED";
  current.stopReason = reason || "Cancelled by user request";
  current.completedAt = new Date().toISOString();
  saveRunRecord(current);
  appendRunEvent(runId, "cancellation", `Run cancelled: ${current.stopReason}`);

  // 2. Terminate active processes and abort controller
  const controller = activeRunControllers.get(runId);
  if (controller) {
    controller.abort(new Error(reason || "Run cancelled by user request"));
  }

  const cleanupResult = await cleanupRunResources(runId, reason || "Run cancelled");

  // 3. Fallback disk cleanups if needed
  const runDir = path.join(ARTIFACTS_DIR, "runs", runId);
  const minishopDir = path.join(runDir, "workspace", "apps", "minishop");
  const pristineDir = path.join(runDir, "pristine", "apps", "minishop");
  const lockPath = path.join(runDir, "run.lock");
  const legacyLockPath = path.join(runDir, ".workspace.lock");

  const fallbackWs: RunWorkspace = {
    runId,
    workspaceDir: path.join(runDir, "workspace"),
    minishopDir,
    pristineMinishopDir: pristineDir,
    lockPath,
    sourceManifest: [],
    originalSourceFingerprint: "",
    runDir,
  };

  if (deps?.stopApp) {
    try {
      await deps.stopApp(fallbackWs);
    } catch (err: any) {
      cleanupResult.errors.push(`Custom stopApp failed: ${err.message}`);
    }
  }

  try {
    releaseWorkspaceLock(fallbackWs);
    if (fs.existsSync(legacyLockPath)) {
      fs.unlinkSync(legacyLockPath);
    }
  } catch (err: any) {
    cleanupResult.errors.push(`Lock release failed: ${err.message}`);
  }

  if (cleanupResult.errors.length > 0) {
    appendRunEvent(runId, "cleanup_warning", `Cleanup completed with warnings: ${cleanupResult.errors.join("; ")}`);
  }

  return current;
}

export function getRepairRun(runId: string): RepairRunRecord | null {
  const run = getRunRecord(runId);
  return run ? withDiscoveredBaselineArtifacts(run) : null;
}

export function listRepairRuns(caseId?: string): RepairRunRecord[] {
  return listRunRecords(caseId).map(withDiscoveredBaselineArtifacts);
}

function withDiscoveredBaselineArtifacts(run: RepairRunRecord): RepairRunRecord {
  if (run.baselineArtifacts?.screenshot || run.baselineArtifacts?.trace || run.baselineArtifacts?.resultJson) return run;
  const baselineDir = path.join(ARTIFACTS_DIR, "runs", run.runId, "baseline");
  if (!fs.existsSync(baselineDir)) return run;
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
    }
  };
  visit(baselineDir);
  const reference = (file: string | undefined) => file
    ? `artifacts/${path.relative(ARTIFACTS_DIR, file).replace(/\\/g, "/")}`
    : undefined;
  const artifacts = {
    screenshot: reference(files.find(file => file.toLowerCase().endsWith(".png"))),
    trace: reference(files.find(file => path.basename(file).toLowerCase() === "trace.zip")),
    resultJson: reference(files.find(file => path.basename(file).toLowerCase() === "result.json")),
  };
  return artifacts.screenshot || artifacts.trace || artifacts.resultJson ? { ...run, baselineArtifacts: artifacts } : run;
}
