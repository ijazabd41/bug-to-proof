import { randomUUID } from "crypto";
import express from "express";
import path from "path";
import { readCase, writeCase } from "../storage/caseStore";
import { ARTIFACTS_DIR, WORKSPACE_ROOT } from "../utils/paths";
import { discoverTargetSurface } from "../reproduction/targetDiscovery";
import { generateReproductionCandidate } from "../reproduction/generationProvider";
import { ReproductionRunStore } from "../reproduction/reproductionRunStore";
import { ReproductionService } from "../reproduction/reproductionService";
import { ReproductionReviewError, ReproductionReviewService } from "../reproduction/reproductionReviewService";
import { runTest } from "../runner/playwrightRunner";
import { cleanupRunResources, registerRunController } from "../ai/repair/runtimeRegistry";
import { computeSourceManifest } from "../ai/repair/workspace";

const recordsRoot = path.join(ARTIFACTS_DIR, "reproduction-runs", "records");
const generatedRoot = path.join(ARTIFACTS_DIR, "reproduction-runs", "generated");
const acceptedRoot = path.join(ARTIFACTS_DIR, "reproduction-runs", "accepted");
export const reproductionRunStore = new ReproductionRunStore(recordsRoot);
const active = new Map<string, AbortController>();

export const reproductionService = new ReproductionService({
  store: reproductionRunStore,
  generatedRoot,
  discover: async () => discoverTargetSurface(path.join(WORKSPACE_ROOT, "apps/minishop")),
  generate: generateReproductionCandidate,
  execute: ({ caseId, testFile, targetUrl, runId, timeoutMs, abortSignal }) => runTest(caseId, testFile, "before", {
    targetUrl, runId, timeoutMs, abortSignal, generatedTestRoot: generatedRoot,
    artifactDir: path.join(ARTIFACTS_DIR, "reproduction-runs", runId, "evidence"),
  }),
  fingerprintSource: () => computeSourceManifest(path.join(WORKSPACE_ROOT, "apps/minishop")).fingerprint,
});
export const reproductionReviewService = new ReproductionReviewService({
  store: reproductionRunStore, generatedRoot, acceptedRoot,
  execute: ({ caseId, testFile, targetUrl, runId, timeoutMs, generatedTestRoot }) => runTest(caseId, testFile, "before", {
    targetUrl, runId, timeoutMs, generatedTestRoot,
    artifactDir: path.join(ARTIFACTS_DIR, "reproduction-runs", runId, "evidence"),
  }),
  fingerprintSource: () => computeSourceManifest(path.join(WORKSPACE_ROOT, "apps/minishop")).fingerprint,
});

export const reproductionRunsRouter = express.Router();

reproductionRunsRouter.post("/cases/:caseId/reproduction-runs", (req, res) => {
  const bugCase = readCase(req.params.caseId);
  if (!bugCase) { res.status(404).json({ error: "Case not found", code: "REPRODUCTION_RUN_NOT_FOUND" }); return; }
  if (!bugCase.reportCompleteness?.complete || !bugCase.report) {
    res.status(409).json({ error: "Report details are required before generation", code: "REPORT_DETAILS_REQUIRED", details: bugCase.reportCompleteness?.missingFields.join(", ") }); return;
  }
  const reproductionRunId = randomUUID(); const controller = new AbortController(); active.set(reproductionRunId, controller); registerRunController(reproductionRunId, controller);
  void reproductionService.run({ reproductionRunId, caseId: bugCase.id, targetUrl: process.env.MINISHOP_BASE_URL ?? "http://localhost:5174",
    report: { title: bugCase.title, description: bugCase.description, steps: bugCase.report.steps, expected: bugCase.report.expected, actual: bugCase.report.actual,
      startPath: bugCase.report.startPath, context: bugCase.report.context }, abortSignal: controller.signal })
    .catch(error => {
      const diagnostic = (error instanceof Error ? error.message : String(error)).slice(0, 16_000);
      const run = reproductionRunStore.read(reproductionRunId);
      if (run && !run.completedAt) { const timestamp = new Date().toISOString(); run.state = "BLOCKED"; run.stopReason = `Unexpected reproduction service failure: ${diagnostic}`;
        run.updatedAt = timestamp; run.completedAt = timestamp; run.events = [...run.events, { sequence: run.events.length + 1, state: "BLOCKED", message: run.stopReason, createdAt: timestamp }]; reproductionRunStore.write(run); }
      console.error(`[reproduction] Run ${reproductionRunId} failed:`, diagnostic);
    })
    .finally(async () => { active.delete(reproductionRunId); await cleanupRunResources(reproductionRunId); });
  res.status(202).json({ reproductionRunId, caseId: bugCase.id, state: "DISCOVERING_TARGET" });
});

reproductionRunsRouter.get("/cases/:caseId/reproduction-runs", (req, res, next) => {
  try { res.json(reproductionRunStore.listForCase(req.params.caseId)); } catch (err) { next(err); }
});
reproductionRunsRouter.get("/reproduction-runs/:runId", (req, res, next) => {
  try {
    const run = reproductionRunStore.read(req.params.runId);
    if (!run) { res.status(404).json({ error: "Reproduction run not found", code: "REPRODUCTION_RUN_NOT_FOUND" }); return; }
    res.json(run);
  } catch (err) { next(err); }
});
reproductionRunsRouter.post("/reproduction-runs/:runId/review", async (req, res, next) => {
  try {
    const run = reproductionRunStore.read(req.params.runId);
    if (!run) { res.status(404).json({ error: "Reproduction run not found", code: "REPRODUCTION_RUN_NOT_FOUND" }); return; }
    const bugCase = readCase(run.caseId);
    if (!bugCase) { res.status(404).json({ error: "Case not found", code: "REPRODUCTION_RUN_NOT_FOUND" }); return; }
    const { decision, definitionHash, compiledTestHash, acceptedBy, reviewerNotes } = req.body ?? {};
    if (!(["APPROVE", "REJECT"] as unknown[]).includes(decision) || !/^[a-f0-9]{64}$/.test(definitionHash ?? "") ||
      !/^[a-f0-9]{64}$/.test(compiledTestHash ?? "") || typeof acceptedBy !== "string" || !acceptedBy.trim()) {
      res.status(400).json({ error: "decision, candidate hashes, and reviewer identity are required", code: "REPRODUCTION_RUN_CONFLICT" }); return;
    }
    const reviewed = await reproductionReviewService.review({ runId: run.reproductionRunId, decision, definitionHash, compiledTestHash,
      acceptedBy, reviewerNotes: typeof reviewerNotes === "string" ? reviewerNotes : undefined,
      currentReport: { title: bugCase.title, description: bugCase.description, steps: bugCase.report?.steps, expected: bugCase.report?.expected,
        actual: bugCase.report?.actual, startPath: bugCase.report?.startPath, context: bugCase.report?.context } });
    if (reviewed.state === "REPRODUCED" && reviewed.acceptedCandidate && reviewed.baselineRun) {
      bugCase.reproduction = { preconditions: [], steps: bugCase.report?.steps ?? [], expected: bugCase.report?.expected ?? "",
        actual: bugCase.report?.actual ?? "", testFile: reviewed.acceptedCandidate.frozenTestPath, testRoot: acceptedRoot,
        generatedTest: { reproductionRunId: reviewed.reproductionRunId, definitionHash: reviewed.acceptedCandidate.definitionHash,
          compiledTestHash: reviewed.acceptedCandidate.compiledTestHash, sourceFingerprint: reviewed.targetSnapshot!.sourceFingerprint,
          acceptedAt: reviewed.acceptedCandidate.acceptedAt, acceptedBy: reviewed.acceptedCandidate.acceptedBy }, lastRun: reviewed.baselineRun };
      bugCase.verification = { status: "PENDING", beforeRun: reviewed.baselineRun, afterRun: null, comparison: null };
      bugCase.status = "REPRODUCED"; bugCase.updatedAt = new Date().toISOString(); writeCase(bugCase);
    }
    res.json(reviewed);
  } catch (error) {
    if (error instanceof ReproductionReviewError) {
      res.status(error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400).json({ error: error.message,
        code: error.code === "NOT_FOUND" ? "REPRODUCTION_RUN_NOT_FOUND" : "REPRODUCTION_RUN_CONFLICT" }); return;
    }
    next(error);
  }
});
reproductionRunsRouter.post("/reproduction-runs/:runId/cancel", (req, res, next) => {
  try {
    const run = reproductionRunStore.read(req.params.runId);
    if (!run) { res.status(404).json({ error: "Reproduction run not found", code: "REPRODUCTION_RUN_NOT_FOUND" }); return; }
    const controller = active.get(req.params.runId);
    if (run.state === "CANCELLED") { res.status(200).json({ reproductionRunId: run.reproductionRunId, state: "CANCELLED" }); return; }
    if (run.completedAt || !controller) { res.status(409).json({ error: "Reproduction run is not active", code: "REPRODUCTION_RUN_CONFLICT" }); return; }
    controller.abort(new Error("Cancelled by user")); const timestamp = new Date().toISOString(); run.state = "CANCELLED"; run.stopReason = "Cancelled by user";
    run.updatedAt = timestamp; run.completedAt = timestamp; run.events = [...run.events, { sequence: run.events.length + 1, state: "CANCELLED", message: "Cancellation persisted", createdAt: timestamp }]; reproductionRunStore.write(run);
    res.status(202).json({ reproductionRunId: run.reproductionRunId, state: "CANCELLED" });
  } catch (err) { next(err); }
});
