import { Router } from "express";
import { answerQuestion } from "../ai/rag";
import { debugCase } from "../ai/debugAgent";
import { ragConfig } from "../ai/providers";
import { loadCorpus } from "../ai/corpus";
import { loadIndex } from "../ai/vectorIndex";
import { readCase } from "../storage/caseStore";
import {
  createRepairRunRecord,
  executeRepairRun,
  reviewAndApplyRepairRun,
  cancelRepairRun,
} from "../ai/repair/repairService";
import {
  getRunRecord,
  listRunRecords,
} from "../ai/repair/runStore";
import { buildProofBundle } from "../ai/repair/proofBundle";

export const aiRouter = Router();

aiRouter.get("/status", async (_req, res) => {
  try {
    const config = ragConfig();
    const corpus = await loadCorpus(config.chunkSize, config.chunkOverlap, "source");
    res.json({
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      semantic: config.embeddingProvider !== "lexical",
      generationProvider: config.generationProvider,
      generationModel: config.generationModel,
      chunks: corpus.chunks.length,
      corpusFingerprint: corpus.fingerprint,
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      topK: config.topK,
    });
  } catch {
    res.status(503).json({ error: "RAG configuration is unavailable", code: "RAG_UNAVAILABLE" });
  }
});

aiRouter.post("/index", async (_req, res) => {
  try {
    const config = ragConfig();
    const index = await loadIndex(config);
    res.json({
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      indexFingerprint: index.fingerprint,
      chunks: index.chunks.length,
      cacheHit: index.cacheHit,
      buildMs: index.buildMs,
    });
  } catch {
    res.status(503).json({ error: "Indexing is unavailable. Check the configured embedding provider.", code: "RAG_UNAVAILABLE" });
  }
});

aiRouter.post("/ask", async (req, res) => {
  if (typeof req.body.question !== "string" || !req.body.question.trim() || req.body.question.length > 4000) {
    res.status(400).json({ error: "question must contain 1 to 4000 characters" });
    return;
  }
  const scope = req.body.scope ?? "source";
  if (scope !== "source" && scope !== "documentation") {
    res.status(400).json({ error: "scope must be 'source' or 'documentation'" });
    return;
  }
  try {
    res.json(await answerQuestion(req.body.question, scope));
  } catch {
    res.status(503).json({ error: "Retrieval is unavailable. Check the configured embedding provider.", code: "RAG_UNAVAILABLE" });
  }
});

aiRouter.post("/cases/:id/debug", async (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(req.params.id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (req.body.applyPatch !== undefined && typeof req.body.applyPatch !== "boolean") {
    res.status(400).json({ error: "applyPatch must be a boolean" });
    return;
  }
  if (!bugCase.reproduction?.testFile || ["REPRODUCING", "VERIFYING"].includes(bugCase.status)) {
    res.status(409).json({ error: "Case needs an idle reproduction test" });
    return;
  }
  try {
    res.json(await debugCase(req.params.id, req.body.applyPatch === true));
  } catch (error) {
    next(error);
  }
});

// ── Dynamic AI Repair Routes ──────────────────────────────────────────────────

aiRouter.get("/repair-runs", (req, res, next) => {
  try {
    const caseId = typeof req.query.caseId === "string" ? req.query.caseId : undefined;
    res.json(listRunRecords(caseId));
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/cases/:id/repair-runs", (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  try {
    const bugCase = readCase(req.params.id);
    if (!bugCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    res.json(listRunRecords(req.params.id));
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/repair-runs/:runId", (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.runId)) {
    res.status(400).json({ error: "Invalid run ID format" });
    return;
  }
  try {
    const record = getRunRecord(req.params.runId);
    if (!record) {
      res.status(404).json({ error: "Repair run not found" });
      return;
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/repair-runs/:runId/bundle.zip", async (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.runId)) {
    res.status(400).json({ error: "Invalid run ID format" });
    return;
  }
  try {
    const bundle = await buildProofBundle(req.params.runId);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.filename}"`);
    res.setHeader("Content-Length", bundle.buffer.length);
    res.end(bundle.buffer);
  } catch (error: any) {
    if (error.message?.includes("Repair run not found")) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

aiRouter.post("/cases/:id/repair-runs", async (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.id)) {
    res.status(400).json({ error: "Invalid case ID format" });
    return;
  }
  const bugCase = readCase(req.params.id);
  if (!bugCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (!bugCase.reproduction?.testFile) {
    res.status(400).json({
      error: "Case does not have a configured reproduction test",
      code: "REPRODUCTION_TEST_REQUIRED",
      details: "Generate, review, and confirm a reproduction candidate before starting repair",
    });
    return;
  }
  if (["REPRODUCING", "VERIFYING"].includes(bugCase.status)) {
    res.status(409).json({ error: "Cannot start repair run while evidence run is active" });
    return;
  }

  // Sanitize and validate public API configuration
  const rawBody = req.body || {};
  const maxAttempts =
    typeof rawBody.maxAttempts === "number" && rawBody.maxAttempts >= 1 && rawBody.maxAttempts <= 5
      ? Math.floor(rawBody.maxAttempts)
      : 3;
  const timeoutMs =
    typeof rawBody.timeoutMs === "number" && rawBody.timeoutMs >= 10_000 && rawBody.timeoutMs <= 300_000
      ? rawBody.timeoutMs
      : 120_000;

  const sanitizedConfig = {
    mode: "dynamic" as const,
    maxAttempts,
    timeoutMs,
  };

  try {
    const run = createRepairRunRecord(req.params.id, sanitizedConfig);
    // Execute repair run in background asynchronously
    void executeRepairRun(run.runId, {}, sanitizedConfig).catch((err) => {
      console.error(`[RepairService] Background repair run ${run.runId} failed:`, err);
    });
    res.status(201).json(run);
  } catch (error: any) {
    if (error.message?.includes("Case not found")) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

aiRouter.post("/repair-runs/:runId/review", async (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.runId)) {
    res.status(400).json({ error: "Invalid run ID format" });
    return;
  }

  const { proposalId, proposalHash, decision, reviewerNotes } = req.body || {};
  if (!proposalId || !proposalHash || !decision) {
    res.status(400).json({
      error: "Review must include proposalId, proposalHash, and decision ('APPROVED' or 'REJECTED')",
    });
    return;
  }
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(String(proposalId))) {
    res.status(400).json({ error: "Invalid proposalId format" });
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(String(proposalHash))) {
    res.status(400).json({ error: "Invalid proposalHash format (must be 64-char hex SHA-256)" });
    return;
  }
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    res.status(400).json({ error: "decision must be 'APPROVED' or 'REJECTED'" });
    return;
  }

  try {
    const updatedRun = await reviewAndApplyRepairRun(req.params.runId, {
      proposalId: String(proposalId),
      proposalHash: String(proposalHash),
      decision,
      reviewerNotes: typeof reviewerNotes === "string" ? reviewerNotes.slice(0, 2000) : undefined,
    });
    res.json(updatedRun);
  } catch (error: any) {
    if (error.message?.includes("Repair run not found")) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (
      error.message?.includes("Cannot review run in state") ||
      error.message?.includes("Cannot review or apply a cancelled") ||
      error.message?.includes("Exact approval binding failed") ||
      error.message?.includes("already in progress")
    ) {
      res.status(409).json({ error: "Invalid state transition", details: error.message });
      return;
    }
    next(error);
  }
});

aiRouter.post("/repair-runs/:runId/cancel", async (req, res, next) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(req.params.runId)) {
    res.status(400).json({ error: "Invalid run ID format" });
    return;
  }
  try {
    const cancelled = await cancelRepairRun(req.params.runId);
    res.json(cancelled);
  } catch (error: any) {
    if (error.message?.includes("Repair run not found")) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});
