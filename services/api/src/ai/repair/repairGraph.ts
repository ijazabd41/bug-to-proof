import fs from "fs";
import path from "path";
import http from "http";
import { Annotation, StateGraph, START, END, interrupt } from "@langchain/langgraph";
import type { TestRun } from "@bug-to-proof/shared-types";
import { generatedTestFingerprint, runTest } from "../../runner/playwrightRunner";
import { testFingerprint } from "../../runner/integrity";
import type {
  RepairRunRecord,
  RepairRunState,
  RepairRunConfig,
  RepairEvent,
  ModelProposal,
  ProposalReview,
  AttemptRecord,
  RequiredCheckResult,
} from "./contracts";
import { computeProposalHash } from "./contracts";
import {
  createRunWorkspace,
  startIsolatedMiniShop,
  stopIsolatedMiniShop,
  releaseWorkspaceLock,
  restoreOriginalWorkspace,
  computeSourceManifest,
  RunWorkspace,
} from "./workspace";
import {
  saveRunRecord,
  getRunRecord,
  appendRunEvent,
} from "./runStore";
import { generateProposal } from "./proposal";
import {
  validateEdits,
  applyEditsTransactionally,
  generateUnifiedDiff,
  computeExpectedPatchedFingerprint,
} from "./patchPolicy";
import {
  runRequiredChecks,
  validateVerificationGates,
  validateBaselineGates,
} from "./verification";
import { getRunResources } from "./runtimeRegistry";
import { FileCheckpointSaver } from "./fileCheckpointer";

export const RepairGraphAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  caseId: Annotation<string>(),
  caseTitle: Annotation<string>(),
  caseDescription: Annotation<string>(),
  reproductionTestFile: Annotation<string>(),
  reproductionTestRoot: Annotation<string | undefined>(),
  testFingerprint: Annotation<string>(),
  config: Annotation<RepairRunConfig | undefined>(),
  deadlineMs: Annotation<number | null | undefined>(),

  // Workspace snapshot and ephemeral app URL
  workspace: Annotation<RunWorkspace | null>(),
  appUrl: Annotation<string | null>(),

  // Run lifecycle state
  state: Annotation<RepairRunState>(),
  attempt: Annotation<number>(),
  maxAttempts: Annotation<number>(),
  attempts: Annotation<AttemptRecord[]>({ reducer: (_a, b) => b, default: () => [] }),
  diagnostics: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),

  // Evidence and check artifacts
  baselineRun: Annotation<TestRun | null>(),
  proposal: Annotation<ModelProposal | null>(),
  review: Annotation<ProposalReview | null>(),
  postPatchRun: Annotation<TestRun | null>(),
  requiredChecks: Annotation<RequiredCheckResult[]>({ reducer: (_a, b) => b, default: () => [] }),

  // Stop reason and final error
  stopReason: Annotation<string | undefined>(),
  error: Annotation<string | undefined>(),
  completedAt: Annotation<string | undefined>(),

  // Latencies for current attempt
  attemptStartAt: Annotation<number | undefined>(),
  tBaselineMs: Annotation<number | undefined>(),
  tProposalMs: Annotation<number | undefined>(),
  tPostPatchMs: Annotation<number | undefined>(),
  tChecksMs: Annotation<number | undefined>(),

  // Event stream
  events: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

export type RepairGraphStateType = typeof RepairGraphAnnotation.State;

export interface RepairGraphDependencies {
  run: typeof runTest;
  checks: typeof runRequiredChecks;
  generate: typeof generateProposal;
  startApp: typeof startIsolatedMiniShop;
  stopApp: typeof stopIsolatedMiniShop;
  checkpointer?: any;
}

export type RepairDependencies = RepairGraphDependencies;

export const defaultGraphDependencies: RepairGraphDependencies = {
  run: runTest,
  checks: runRequiredChecks,
  generate: generateProposal,
  startApp: startIsolatedMiniShop,
  stopApp: stopIsolatedMiniShop,
  checkpointer: new FileCheckpointSaver(),
};

/**
 * Builds the modular LangGraph StateGraph orchestrator for Dynamic AI Repair.
 */
export function buildRepairGraph(dependencies: Partial<RepairGraphDependencies> = {}) {
  const deps: RepairGraphDependencies = { ...defaultGraphDependencies, ...dependencies };

  function syncDurableRecord(
    state: Partial<RepairGraphStateType>,
    runId: string,
    event?: { stage: string; message: string; data?: Record<string, unknown> }
  ) {
    const existing = getRunRecord(runId);
    if (!existing) return;

    const events = [...existing.events];
    if (event) {
      events.push({
        timestamp: new Date().toISOString(),
        stage: event.stage,
        message: event.message,
        ...(event.data ? { data: event.data } : {}),
      });
    }

    const updated: RepairRunRecord = {
      ...existing,
      state: state.state ?? existing.state,
      attempt: state.attempt ?? existing.attempt,
      maxAttempts: state.maxAttempts ?? existing.maxAttempts,
      attempts: state.attempts ?? existing.attempts,
      diagnostics: state.diagnostics ?? existing.diagnostics,
      baselineRun: state.baselineRun !== undefined ? (state.baselineRun ?? undefined) : existing.baselineRun,
      proposal: state.proposal !== undefined ? (state.proposal ?? undefined) : existing.proposal,
      review: state.review !== undefined ? (state.review ?? undefined) : existing.review,
      postPatchRun: state.postPatchRun !== undefined ? (state.postPatchRun ?? undefined) : existing.postPatchRun,
      requiredChecks: state.requiredChecks ?? existing.requiredChecks,
      stopReason: state.stopReason ?? existing.stopReason,
      error: state.error ?? existing.error,
      completedAt: state.completedAt ?? existing.completedAt,
      events,
      updatedAt: new Date().toISOString(),
    };
    saveRunRecord(updated);
  }

  const workflow = new StateGraph(RepairGraphAnnotation)
    // 1. Workspace Preparation Node
    .addNode("prepareWorkspace", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      const ws = state.workspace ?? createRunWorkspace(state.runId);

      // Seed defects to isolated workspace snapshot if provided
      if (state.config?.seedDefects && state.config.seedDefects.length > 0) {
        for (const seed of state.config.seedDefects) {
          const fullPath = path.join(ws.minishopDir, seed.relativePath);
          const pristinePath = path.join(ws.pristineMinishopDir, seed.relativePath);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const normalizedOriginal = seed.originalSnippet.replace(/\r\n/g, "\n");
            const normalizedDefective = seed.defectiveSnippet.replace(/\r\n/g, "\n");
            const normalizedContent = content.replace(/\r\n/g, "\n");
            const defectiveContent = normalizedContent.replace(normalizedOriginal, normalizedDefective);
            fs.writeFileSync(fullPath, defectiveContent, "utf-8");
            fs.writeFileSync(pristinePath, defectiveContent, "utf-8");
          }
        }
        const { manifest, fingerprint } = computeSourceManifest(ws.minishopDir);
        ws.sourceManifest = manifest;
        ws.originalSourceFingerprint = fingerprint;
      }

      // Start isolated MiniShop
      const app = await deps.startApp(ws);

      const existingRecord = getRunRecord(state.runId);
      const initialEvent: RepairEvent = {
        timestamp: new Date().toISOString(),
        stage: "initialization",
        message: "Created isolated workspace snapshot and started app",
        data: {
          originalSourceFingerprint: ws.originalSourceFingerprint,
          url: app.url,
        },
      };

      const record: RepairRunRecord = {
        schemaVersion: "1.0",
        runId: state.runId,
        caseId: state.caseId,
        mode: state.config?.mode ?? existingRecord?.mode ?? "dynamic",
        state: "INITIALIZING",
        attempt: 1,
        maxAttempts: state.maxAttempts ?? existingRecord?.maxAttempts ?? 3,
        attempts: existingRecord?.attempts ?? [],
        inputs: existingRecord?.inputs,
        diagnostics: existingRecord?.diagnostics ?? [],
        pricingConfig: state.config?.pricingConfig ?? existingRecord?.pricingConfig,
        originalSourceFingerprint: ws.originalSourceFingerprint,
        targetSnapshotDir: ws.workspaceDir,
        testFingerprint: state.testFingerprint,
        reproductionTestFile: state.reproductionTestFile,
        reproductionTestRoot: state.reproductionTestRoot,
        requiredChecks: existingRecord?.requiredChecks ?? [],
        events: [...(existingRecord?.events ?? []), initialEvent],
        createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveRunRecord(record);

      return {
        workspace: ws,
        appUrl: app.url,
        state: "INITIALIZING" as const,
        attempt: 1,
        events: ["Initialized workspace snapshot"],
      };
    })

    // 2. Baseline Reproduction Node
    .addNode("reproduceBaseline", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      const tStart = Date.now();
      const baselineArtifactDir = path.join(state.workspace!.runDir, "baseline");
      const baselineResult = await deps.run(state.caseId, state.reproductionTestFile, "before", {
        runId: state.runId,
        targetUrl: state.appUrl!,
        artifactDir: baselineArtifactDir,
        abortSignal: activeRes?.abortController.signal,
        ...(state.reproductionTestRoot ? { generatedTestRoot: state.reproductionTestRoot } : {}),
      });
      const tBaselineMs = Date.now() - tStart;

      // Check if cancelled during baseline run
      const postRunCur = getRunRecord(state.runId);
      if (postRunCur?.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const, stopReason: postRunCur?.stopReason || "Run cancelled during execution" };
      }

      const baselineRun: TestRun = {
        outcome: baselineResult.outcome,
        testFingerprint: baselineResult.testFingerprint,
        testIds: baselineResult.testIds,
        runId: baselineResult.runId,
        reportHash: baselineResult.reportHash,
        runAt: new Date().toISOString(),
        passed: baselineResult.passed,
        expected: baselineResult.expected,
        actual: baselineResult.actual,
        durationMs: baselineResult.durationMs,
        evidenceIds: [],
      };

      if (baselineResult.outcome !== "ASSERTION_FAILED") {
        const stopReason =
          baselineResult.outcome === "PASSED"
            ? "The reported failure was not reproduced on original source."
            : `Baseline reproduction failed with infrastructure error: ${baselineResult.actual}`;
        syncDurableRecord({ baselineRun, state: "BLOCKED", stopReason }, state.runId, {
          stage: "baseline",
          message: `Baseline verification stopped: ${stopReason}`,
        });
        return {
          baselineRun,
          state: "BLOCKED" as const,
          stopReason,
          tBaselineMs,
          events: [`Baseline outcome: ${baselineResult.outcome}`],
        };
      }

      // Check baseline gates early
      const baseGate = validateBaselineGates({
        caseId: state.caseId,
        reproductionTestFile: state.reproductionTestFile,
        reproductionTestRoot: state.reproductionTestRoot,
        testFingerprint: state.testFingerprint,
        baselineRun,
        baselineArtifactDir,
        mode: state.config?.mode,
      });

      if (!baseGate.verified) {
        const stopReason = `Baseline evidence gates violated: ${baseGate.violations.join("; ")}`;
        syncDurableRecord({ baselineRun, state: "BLOCKED", stopReason }, state.runId, {
          stage: "baseline",
          message: `Baseline verification stopped: ${stopReason}`,
        });
        return {
          baselineRun,
          state: "BLOCKED" as const,
          stopReason,
          tBaselineMs,
          events: [`Baseline gate violation: ${baseGate.violations[0]}`],
        };
      }

      syncDurableRecord({ baselineRun, state: "REPRODUCING_BASELINE" }, state.runId, {
        stage: "baseline",
        message: `Valid baseline failure confirmed: ${baselineResult.expected} vs ${baselineResult.actual}`,
      });
      return {
        baselineRun,
        state: "REPRODUCING_BASELINE" as const,
        tBaselineMs,
        events: ["Valid baseline failure confirmed"],
      };
    })

    // 3. Source Investigation Node
    .addNode("investigateSource", async (state) => {
      if (state.deadlineMs && Date.now() > state.deadlineMs) {
        throw new Error(`Run deadline exceeded (${state.config?.timeoutMs}ms limit)`);
      }
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      syncDurableRecord({ state: "INVESTIGATING", attempt: state.attempt }, state.runId, {
        stage: "investigation",
        message: `Investigating source files (Attempt ${state.attempt})`,
      });

      return {
        state: "INVESTIGATING" as const,
        attemptStartAt: Date.now(),
        events: [`Started investigation for attempt ${state.attempt}`],
      };
    })

    // 4. Model-Generated Patch Proposal Node
    .addNode("proposePatch", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      const tStart = Date.now();
      const proposal = await deps.generate({
        caseTitle: state.caseTitle,
        caseDescription: state.caseDescription,
        reproductionTestFile: state.reproductionTestFile,
        minishopDir: state.workspace!.minishopDir,
        attempt: state.attempt,
        diagnostics: state.diagnostics,
        config: state.config,
        runId: state.runId,
        abortSignal: activeRes?.abortController.signal,
      });
      const tProposalMs = Date.now() - tStart;

      return {
        proposal,
        tProposalMs,
        events: [`Generated patch proposal ${proposal.proposalId}`],
      };
    })

    // 5. Proposal Validation Node
    .addNode("validateProposal", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      if (!state.proposal) {
        return { error: "No proposal was generated", state: "INVESTIGATING" as const };
      }

      const validation = validateEdits(state.workspace!.minishopDir, state.proposal.edits);
      if (!validation.valid) {
        return {
          error: `Proposal validation failed: ${validation.error}`,
          events: [`Validation failure: ${validation.error}`],
        };
      }

      const diff = generateUnifiedDiff(state.workspace!.minishopDir, state.proposal.edits);
      const hash = computeProposalHash(
        state.proposal.edits,
        state.proposal.diagnosis,
        state.proposal.rationale
      );

      const validatedProposal: ModelProposal = {
        ...state.proposal,
        unifiedDiff: diff,
        proposalHash: hash,
      };

      const attemptRecord: AttemptRecord = {
        attemptNumber: state.attempt,
        proposal: validatedProposal,
        state: "AWAITING_REVIEW",
        startedAt: new Date(state.attemptStartAt ?? Date.now()).toISOString(),
        stageLatenciesMs: {
          ...(state.tBaselineMs != null ? { baseline: state.tBaselineMs } : {}),
          ...(state.tProposalMs != null ? { proposal: state.tProposalMs } : {}),
        },
      };

      const attempts = [...state.attempts.filter((a) => a.attemptNumber !== state.attempt), attemptRecord];

      syncDurableRecord(
        {
          state: "AWAITING_REVIEW",
          proposal: validatedProposal,
          attempts,
        },
        state.runId,
        {
          stage: "proposal",
          message: "Generated and validated patch proposal. Awaiting exact review approval.",
          data: {
            proposalId: validatedProposal.proposalId,
            proposalHash: validatedProposal.proposalHash,
            attempt: state.attempt,
          },
        }
      );

      return {
        proposal: validatedProposal,
        state: "AWAITING_REVIEW" as const,
        attempts,
        error: undefined,
        events: ["Proposal validated successfully"],
      };
    })

    // 6. Human Review Pause Node
    .addNode("pauseForReview", async (state) => {
      // Suspend graph execution for human review input
      const review = interrupt({
        message: "Awaiting exact human review approval for proposed patch",
        proposal: state.proposal,
        attempt: state.attempt,
      }) as ProposalReview;

      return {
        review,
        events: [`Review decision received: ${review.decision}`],
      };
    })

    // 7. Approved Patch Application Node
    .addNode("applyApprovedPatch", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      if (!state.review || state.review.decision !== "APPROVED") {
        throw new Error("Cannot apply patch without approved review decision");
      }
      if (!state.proposal) {
        throw new Error("No proposal available to apply");
      }

      // Exact approval hash verification
      if (state.review.proposalHash !== state.proposal.proposalHash) {
        throw new Error(
          `Exact approval binding failed: review proposalHash (${state.review.proposalHash}) does not match current proposal (${state.proposal.proposalHash})`
        );
      }

      if (state.review.proposalId !== state.proposal.proposalId) {
        throw new Error(
          `Exact approval binding failed: review proposalId (${state.review.proposalId}) does not match current proposal (${state.proposal.proposalId})`
        );
      }

      // Recompute and verify canonical hash
      const recomputedHash = computeProposalHash(
        state.proposal.edits,
        state.proposal.diagnosis,
        state.proposal.rationale
      );
      if (recomputedHash !== state.review.proposalHash) {
        throw new Error("Proposal hash verification failed: candidate edits have been tampered with");
      }

      // Validate baseline evidence before applying patch
      const baselineArtifactDir = path.join(state.workspace!.runDir, "baseline");
      const baseGate = validateBaselineGates({
        caseId: state.caseId,
        reproductionTestFile: state.reproductionTestFile,
        reproductionTestRoot: state.reproductionTestRoot,
        testFingerprint: state.testFingerprint,
        baselineRun: state.baselineRun,
        baselineArtifactDir,
        mode: state.config?.mode,
      });
      if (!baseGate.verified) {
        throw new Error(
          `Baseline evidence validation failed before patch application: ${baseGate.violations.join("; ")}`
        );
      }

      // Verify reproduction test fingerprint against current disk test
      const currentTestFp = state.reproductionTestRoot ? generatedTestFingerprint(state.reproductionTestFile) : testFingerprint(state.reproductionTestFile);
      if (currentTestFp !== state.testFingerprint) {
        throw new Error("Reproduction test inputs mutated since run creation; patch application rejected");
      }

      // Compute expected patched fingerprint from pristine snapshot + edits
      const expectedPatchedFingerprint = computeExpectedPatchedFingerprint(
        state.workspace!.pristineMinishopDir,
        state.proposal.edits
      );
      state.workspace!.expectedPatchedFingerprint = expectedPatchedFingerprint;

      // Check current candidate workspace state against binary invariant
      const currentSourceManifest = computeSourceManifest(state.workspace!.minishopDir);
      const isOriginalPristine = currentSourceManifest.fingerprint === state.workspace!.originalSourceFingerprint;
      const isAlreadyPatched = currentSourceManifest.fingerprint === expectedPatchedFingerprint;

      if (!isOriginalPristine && !isAlreadyPatched) {
        throw new Error(
          `Candidate workspace snapshot in ambiguous or modified state; patch application rejected (current: ${currentSourceManifest.fingerprint}, expected original: ${state.workspace!.originalSourceFingerprint}, expected patched: ${expectedPatchedFingerprint})`
        );
      }

      // Ensure isolated app process is alive across process restarts
      let appUrl = state.appUrl;
      let appReachable = false;
      if (appUrl) {
        appReachable = await new Promise<boolean>((resolve) => {
          const req = http.get(appUrl!, (res) => resolve(res.statusCode === 200 || res.statusCode === 304));
          req.on("error", () => resolve(false));
          req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
          });
        });
      }
      if (!appReachable && state.workspace) {
        const restartedApp = await deps.startApp(state.workspace);
        appUrl = restartedApp.url;
      }

      // Transactionally apply edits if pristine
      let modifiedFiles = state.proposal.edits.map((e) => e.relativePath);
      if (isOriginalPristine) {
        const applied = applyEditsTransactionally(state.workspace!.minishopDir, state.proposal.edits);
        if (!applied.success) {
          throw new Error(`Failed to apply candidate edits transactionally: ${applied.error}`);
        }
        modifiedFiles = applied.modifiedFiles;

        const postApplyManifest = computeSourceManifest(state.workspace!.minishopDir);
        if (postApplyManifest.fingerprint !== expectedPatchedFingerprint) {
          throw new Error(
            `Patched workspace source fingerprint mismatch. Expected ${expectedPatchedFingerprint}, got ${postApplyManifest.fingerprint}`
          );
        }
      }

      syncDurableRecord(
        { state: "APPLYING", review: state.review ?? undefined },
        state.runId,
        {
          stage: "patch_applied",
          message: "Exact reviewed patch applied transactionally to candidate workspace",
          data: {
            proposalId: state.proposal.proposalId,
            proposalHash: state.proposal.proposalHash,
            modifiedFiles,
            expectedPatchedFingerprint,
          },
        }
      );

      return {
        appUrl,
        state: "APPLYING" as const,
        workspace: state.workspace,
        events: ["Patch applied transactionally"],
      };
    })

    // 8. Post-Patch Reproduction Node
    .addNode("verifyReproduction", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      const tStart = Date.now();
      const verificationArtifactDir = path.join(state.workspace!.runDir, `attempt-${state.attempt}`, "verification");
      const postPatchResult = await deps.run(state.caseId, state.reproductionTestFile, "after", {
        runId: state.runId,
        targetUrl: state.appUrl!,
        artifactDir: verificationArtifactDir,
        abortSignal: activeRes?.abortController.signal,
        ...(state.reproductionTestRoot ? { generatedTestRoot: state.reproductionTestRoot } : {}),
      });
      const tPostPatchMs = Date.now() - tStart;

      const postPatchRun: TestRun = {
        outcome: postPatchResult.outcome,
        testFingerprint: postPatchResult.testFingerprint,
        testIds: postPatchResult.testIds,
        runId: postPatchResult.runId,
        reportHash: postPatchResult.reportHash,
        runAt: new Date().toISOString(),
        passed: postPatchResult.passed,
        expected: postPatchResult.expected,
        actual: postPatchResult.actual,
        durationMs: postPatchResult.durationMs,
        evidenceIds: [],
      };

      syncDurableRecord({ postPatchRun }, state.runId, {
        stage: "verification",
        message: `Post-patch reproduction outcome: ${postPatchResult.outcome} (passed: ${postPatchResult.passed})`,
      });

      return {
        postPatchRun,
        tPostPatchMs,
        events: [`Post-patch outcome: ${postPatchResult.outcome}`],
      };
    })

    // 9. Required Regression Checks Node
    .addNode("runRegressionChecks", async (state) => {
      const cur = getRunRecord(state.runId);
      const activeRes = getRunResources(state.runId);
      if (cur?.state === "CANCELLED" || state.state === "CANCELLED" || activeRes?.abortController.signal.aborted) {
        return { state: "CANCELLED" as const };
      }

      const tStart = Date.now();
      const checksArtifactDir = path.join(state.workspace!.runDir, `attempt-${state.attempt}`, "checks");
      const requiredChecks = await deps.checks(state.workspace!.minishopDir, checksArtifactDir, {
        runId: state.runId,
        abortSignal: activeRes?.abortController.signal,
      });
      const tChecksMs = Date.now() - tStart;

      const allChecksPassed = requiredChecks.length > 0 && requiredChecks.every((c) => c.passed);

      syncDurableRecord({ requiredChecks }, state.runId, {
        stage: "regression",
        message: allChecksPassed
          ? `All ${requiredChecks.length} candidate regression checks passed cleanly.`
          : `Candidate regression checks failed (${requiredChecks.filter((c) => !c.passed).length} failure(s)).`,
      });

      return {
        requiredChecks,
        tChecksMs,
        events: [allChecksPassed ? "Regression checks passed" : "Regression checks failed"],
      };
    })

    // 10. Failed-Attempt Recording and Restoration Node
    .addNode("recordFailedAttemptAndRestore", async (state) => {
      const failureReason =
        state.error ??
        (state.review?.decision === "REJECTED"
          ? `Review rejected: ${state.review.reviewerNotes ?? "No reviewer notes"}`
          : state.postPatchRun?.outcome !== "PASSED"
          ? `Post-patch reproduction failed: ${state.postPatchRun?.actual}`
          : "Required regression checks failed on candidate source");

      // Restore pristine workspace
      restoreOriginalWorkspace(state.workspace!);

      // Gather diagnostics
      const newDiagnostics = [...state.diagnostics, failureReason];

      // Update attempt record
      const currentAttempt: AttemptRecord = {
        attemptNumber: state.attempt,
        proposal: state.proposal ?? undefined,
        state: "VERIFICATION_FAILED",
        startedAt: new Date(state.attemptStartAt ?? Date.now()).toISOString(),
        completedAt: new Date().toISOString(),
        failureReason,
        stageLatenciesMs: {
          ...(state.tBaselineMs != null ? { baseline: state.tBaselineMs } : {}),
          ...(state.tProposalMs != null ? { proposal: state.tProposalMs } : {}),
          ...(state.tPostPatchMs != null ? { postPatchReproduction: state.tPostPatchMs } : {}),
          ...(state.tChecksMs != null ? { regressionChecks: state.tChecksMs } : {}),
        },
      };

      const attempts = [...state.attempts.filter((a) => a.attemptNumber !== state.attempt), currentAttempt];
      const nextAttempt = state.attempt + 1;

      syncDurableRecord(
        {
          attempts,
          diagnostics: newDiagnostics,
          attempt: nextAttempt,
          state: "INVESTIGATING",
        },
        state.runId,
        {
          stage: "retry",
          message: `Attempt ${state.attempt} failed: ${failureReason}. Restoring pristine workspace.`,
        }
      );

      return {
        attempt: nextAttempt,
        attempts,
        diagnostics: newDiagnostics,
        state: "INVESTIGATING" as const,
        proposal: null,
        review: null,
        postPatchRun: null,
        error: undefined,
        events: [`Restored pristine snapshot for attempt ${nextAttempt}`],
      };
    })

    // 11. Evidence-Based Finalization Node
    .addNode("finalizeRun", async (state) => {
      let finalState: RepairRunState = state.state;
      let stopReason = state.stopReason;

      const record = getRunRecord(state.runId);
      if (state.state === "CANCELLED" || record?.state === "CANCELLED") {
        finalState = "CANCELLED";
        stopReason = stopReason || record?.stopReason || "Run cancelled by user request.";
      } else if (state.review?.decision === "REJECTED") {
        finalState = "REJECTED";
        stopReason = `Proposal rejected by reviewer: ${state.review.reviewerNotes ?? "No reviewer notes provided"}`;
      } else {
        const baselineArtifactDir = state.workspace?.runDir ? path.join(state.workspace.runDir, "baseline") : undefined;
        const verificationArtifactDir = state.workspace?.runDir ? path.join(state.workspace.runDir, `attempt-${state.attempt}`, "verification") : undefined;

        // Enforce centralized verification gates before awarding VERIFIED
        const gateCheck = validateVerificationGates({
          caseId: state.caseId,
          reproductionTestFile: state.reproductionTestFile,
          reproductionTestRoot: state.reproductionTestRoot,
          testFingerprint: state.testFingerprint,
          baselineRun: state.baselineRun,
          postPatchRun: state.postPatchRun,
          requiredChecks: state.requiredChecks,
          proposal: state.proposal,
          review: state.review,
          candidateMinishopDir: state.workspace?.minishopDir,
          candidateFingerprint: state.workspace?.expectedPatchedFingerprint,
          baselineArtifactDir,
          postPatchArtifactDir: verificationArtifactDir,
          mode: state.config?.mode,
        });

        if (gateCheck.verified) {
          finalState = "VERIFIED";
          stopReason = "All verification gates and regression checks passed cleanly.";
        } else if (state.postPatchRun && state.postPatchRun.outcome !== "PASSED") {
          if (state.postPatchRun.outcome === "ASSERTION_FAILED") {
            finalState = "VERIFICATION_FAILED";
            stopReason = `Post-patch reproduction failed: ${state.postPatchRun.actual}`;
          } else {
            finalState = "BLOCKED";
            stopReason = `Post-patch reproduction encountered environment/infrastructure error: ${state.postPatchRun.actual}`;
          }
        } else if (state.requiredChecks.length > 0 && !state.requiredChecks.every((c) => c.passed)) {
          finalState = "VERIFICATION_FAILED";
          stopReason = `Required regression checks failed: ${state.requiredChecks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`;
        } else if (!stopReason) {
          finalState = "BLOCKED";
          stopReason = `Verification gates incomplete: ${gateCheck.violations.join("; ")}`;
        }
      }

      // Teardown process and release lock
      if (state.workspace) {
        try {
          await deps.stopApp(state.workspace);
        } catch (err: any) {
          appendRunEvent(state.runId, "cleanup_warning", `Failed to stop app during finalization: ${err.message}`);
        } finally {
          try {
            releaseWorkspaceLock(state.workspace);
          } catch (err: any) {
            appendRunEvent(state.runId, "cleanup_warning", `Failed to release workspace lock: ${err.message}`);
          }
        }
      }

      const completedAt = new Date().toISOString();

      // If attempt record needs final status
      let attempts = state.attempts;
      if (attempts.length > 0) {
        const lastIdx = attempts.length - 1;
        if (finalState === "VERIFIED") {
          attempts = [
            ...attempts.slice(0, lastIdx),
            {
              ...attempts[lastIdx],
              state: "VERIFIED",
              completedAt,
              stageLatenciesMs: {
                ...(attempts[lastIdx].stageLatenciesMs ?? {}),
                ...(state.tPostPatchMs != null ? { postPatchReproduction: state.tPostPatchMs } : {}),
                ...(state.tChecksMs != null ? { regressionChecks: state.tChecksMs } : {}),
              },
            },
          ];
        } else if (finalState === "VERIFICATION_FAILED" || finalState === "BLOCKED") {
          attempts = [
            ...attempts.slice(0, lastIdx),
            {
              ...attempts[lastIdx],
              state: "VERIFICATION_FAILED",
              failureReason: stopReason,
              completedAt,
              stageLatenciesMs: {
                ...(attempts[lastIdx].stageLatenciesMs ?? {}),
                ...(state.tPostPatchMs != null ? { postPatchReproduction: state.tPostPatchMs } : {}),
                ...(state.tChecksMs != null ? { regressionChecks: state.tChecksMs } : {}),
              },
            },
          ];
        } else if (finalState === "REJECTED") {
          attempts = [
            ...attempts.slice(0, lastIdx),
            {
              ...attempts[lastIdx],
              state: "REJECTED",
              failureReason: `Proposal rejected by reviewer: ${state.review?.reviewerNotes ?? "No reviewer notes"}`,
              completedAt,
            },
          ];
        }
      }

      syncDurableRecord(
        {
          state: finalState,
          stopReason,
          completedAt,
          attempts,
          review: state.review ?? undefined,
        },
        state.runId,
        {
          stage: "completion",
          message: `Run finalized with status: ${finalState} (${stopReason})`,
        }
      );

      return {
        state: finalState,
        stopReason,
        completedAt,
        attempts,
        events: [`Finalized with status: ${finalState}`],
      };
    });

  // ── Graph Conditional Routing Edges ──────────────────────────────────────────

  workflow.addEdge(START, "prepareWorkspace");
  workflow.addEdge("prepareWorkspace", "reproduceBaseline");

  // After Baseline:
  workflow.addConditionalEdges("reproduceBaseline", (state) => {
    if (state.state === "CANCELLED" || state.baselineRun?.outcome !== "ASSERTION_FAILED") {
      return "finalizeRun";
    }
    return "investigateSource";
  });

  // After Investigation:
  workflow.addConditionalEdges("investigateSource", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    return "proposePatch";
  });

  workflow.addConditionalEdges("proposePatch", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    return "validateProposal";
  });

  // After Proposal Validation:
  workflow.addConditionalEdges("validateProposal", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    if (state.error) {
      if (state.attempt < state.maxAttempts) {
        return "recordFailedAttemptAndRestore";
      }
      return "finalizeRun";
    }
    return "pauseForReview";
  });

  // After Review Pause:
  workflow.addConditionalEdges("pauseForReview", (state) => {
    if (!state.review) {
      return END;
    }
    if (state.review.decision === "REJECTED") {
      return "finalizeRun";
    }
    return "applyApprovedPatch";
  });

  // After Patch Application:
  workflow.addConditionalEdges("applyApprovedPatch", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    return "verifyReproduction";
  });

  // After Post-Patch Reproduction:
  workflow.addConditionalEdges("verifyReproduction", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    if (state.postPatchRun?.outcome === "PASSED") {
      return "runRegressionChecks";
    }
    // Only retry if it is an actual assertion failure, NOT an infrastructure error
    if (state.postPatchRun?.outcome === "ASSERTION_FAILED" && state.attempt < state.maxAttempts) {
      return "recordFailedAttemptAndRestore";
    }
    return "finalizeRun";
  });

  // After Regression Checks:
  workflow.addConditionalEdges("runRegressionChecks", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    const allPassed =
      state.requiredChecks.length > 0 && state.requiredChecks.every((c) => c.passed);
    if (allPassed) {
      return "finalizeRun";
    }
    if (state.attempt < state.maxAttempts) {
      return "recordFailedAttemptAndRestore";
    }
    return "finalizeRun";
  });

  // After Attempt Restoration & Retry:
  workflow.addConditionalEdges("recordFailedAttemptAndRestore", (state) => {
    if (state.state === "CANCELLED") return "finalizeRun";
    const isDeadlineExceeded = state.deadlineMs ? Date.now() > state.deadlineMs : false;
    if (state.attempt <= state.maxAttempts && !isDeadlineExceeded) {
      return "investigateSource";
    }
    return "finalizeRun";
  });

  workflow.addEdge("finalizeRun", END);

  return workflow.compile({
    checkpointer: deps.checkpointer,
  });
}
