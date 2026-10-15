import path from "path";
import fs from "fs";
import { config } from "dotenv";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "./utils/paths";

// Load .env from workspace root before any other imports read process.env
config({ path: path.join(WORKSPACE_ROOT, ".env") });

import express from "express";
import cors from "cors";
import { casesRouter } from "./routes/cases";
import { reproduceRouter } from "./routes/reproduce";
import { verifyRouter } from "./routes/verify";
import { aiRouter } from "./routes/ai";
import { demoRouter } from "./routes/demo";
import { reproductionRunsRouter, reproductionRunStore } from "./routes/reproductionRuns";
import { errorHandler } from "./middleware/errorHandler";
import { recoverInterruptedRuns } from "./ai/repair/runStore";
import { recoverInterruptedLegacyCases } from "./storage/caseStore";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;
const HOST = process.env.API_HOST || "127.0.0.1";

// ── Security & Safe Opt-in Policy ──────────────────────────────────────────
const isLoopback = HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";
if (!isLoopback) {
  console.warn(
    `[security] API is configured to listen on non-loopback interface (${HOST}). Ensure firewall and network boundary controls are in place.`
  );
}

// ── CORS Origin Configuration ──────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local tools, server-to-server, or allowed dashboard origins
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// ── Public Artifact Delivery Boundary ──────────────────────────────────────
export function isAllowedArtifactPath(relativePath: string): boolean {
  if (typeof relativePath !== "string") return false;
  if (relativePath.includes("..")) return false;
  const normalized = path.normalize(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");

  // Prevent path traversal
  if (normalized.includes("..") || normalized.startsWith("../") || path.isAbsolute(normalized)) {
    return false;
  }

  // Check runs/ namespace: strictly guard internal workspaces and checkpoints
  if (normalized.startsWith("runs/")) {
    // FORBIDDEN: workspaces, pristines, checkpoints, node_modules, .git, locks, tmp files
    if (
      normalized.includes("/workspace/") ||
      normalized.includes("/pristine/") ||
      normalized.includes("/checkpoints/") ||
      normalized.includes("/node_modules/") ||
      normalized.includes("/.git/") ||
      normalized.endsWith(".lock") ||
      normalized.endsWith(".tmp")
    ) {
      return false;
    }

    // ALLOW: public run record (run.json)
    if (/^runs\/[a-zA-Z0-9_-]+\/run\.json$/.test(normalized)) {
      return true;
    }

    // ALLOW: baseline evidence and attempt verification/checks logs & reports
    if (
      /^runs\/[a-zA-Z0-9_-]+\/baseline\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(normalized) ||
      /^runs\/[a-zA-Z0-9_-]+\/attempt-[0-9]+\/(verification|checks)\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(normalized)
    ) {
      return true;
    }

    return false;
  }

  // ALLOW: case evidence paths (including nested subdirectories like case-001/before/run-123/result.json or test-failed-1.png)
  if (/^case-[a-zA-Z0-9_-]+\/(before|after)\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(normalized)) {
    return true;
  }

  // ALLOW: agent reports and report.json under agent/ or agent/runId/
  if (
    /^agent\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*\.(json|md|png|webp|log)$/.test(normalized) ||
    /^agent\/[a-zA-Z0-9_.-]+\.(json|md|png|webp|log)$/.test(normalized)
  ) {
    return true;
  }

  // ALLOW: curated evaluation and test summary artifacts
  if (/^(evaluation|system-testing|runner-regression|portfolio-cart)\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(normalized)) {
    return true;
  }

  // ALLOW: top-level curated reports and media
  if (/^[a-zA-Z0-9_.-]+\.(json|png|webp|mp4|webm|md|log)$/.test(normalized)) {
    return true;
  }

  return false;
}

app.use("/artifacts", (req, res, _next) => {
  const rawPath = req.originalUrl.replace(/^\/artifacts/, "");
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    res.status(400).json({ error: "Malformed URL encoding" });
    return;
  }

  if (decoded.includes("..") || !isAllowedArtifactPath(decoded)) {
    res.status(403).json({ error: "Access to internal artifact or source file is forbidden" });
    return;
  }

  const resolvedArtifactsDir = path.resolve(ARTIFACTS_DIR);
  const targetPath = path.resolve(ARTIFACTS_DIR, "." + req.path);

  if (!targetPath.startsWith(resolvedArtifactsDir)) {
    res.status(403).json({ error: "Path traversal detected" });
    return;
  }

  const relativeFromArtifacts = path.relative(resolvedArtifactsDir, targetPath);
  if (!isAllowedArtifactPath(relativeFromArtifacts)) {
    res.status(403).json({ error: "Access to internal artifact or source file is forbidden" });
    return;
  }

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  res.sendFile(targetPath);
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/cases", casesRouter);
app.use("/api/cases", reproduceRouter);
app.use("/api/cases", verifyRouter);
app.use("/api/demo", demoRouter);
app.use("/api/ai", aiRouter);
app.use("/api", reproductionRunsRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ── Startup Reconciliation ──────────────────────────────────────────────────
// Reconcile legacy running cases and dynamic repair runs from previous process lifecycle
recoverInterruptedLegacyCases();
recoverInterruptedRuns();
reproductionRunStore.recoverInterrupted();

const isDirectRun =
  process.env.NODE_ENV !== "test" &&
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isDirectRun) {
  app.listen(PORT, HOST, () => {
    console.log(`[api] Bug-to-Proof API running on http://${HOST}:${PORT}`);
    console.log(`[api] Safe evidence artifacts served from ${ARTIFACTS_DIR}`);
  });
}

export default app;
