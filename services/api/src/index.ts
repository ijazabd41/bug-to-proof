import path from "path";
import { config } from "dotenv";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "./utils/paths";

// Load .env from workspace root before any other imports read process.env
config({ path: path.join(WORKSPACE_ROOT, ".env") });

import express from "express";
import cors from "cors";
import { casesRouter } from "./routes/cases";
import { reproduceRouter } from "./routes/reproduce";
import { verifyRouter } from "./routes/verify";
import { demoRouter } from "./routes/demo";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── Static artifacts ────────────────────────────────────────────────────────
app.use("/artifacts", express.static(ARTIFACTS_DIR));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/cases", casesRouter);
app.use("/api/cases", reproduceRouter);
app.use("/api/cases", verifyRouter);
app.use("/api/demo", demoRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Bug-to-Proof API running on http://localhost:${PORT}`);
  console.log(`[api] Artifacts served from ${ARTIFACTS_DIR}`);
});

export default app;
