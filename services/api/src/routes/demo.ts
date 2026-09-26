import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { readCase, writeCase } from "../storage/caseStore";
import { DATA_DIR } from "../utils/paths";
import type { BugCase } from "@bug-to-proof/shared-types";

export const demoRouter = Router();

const SEED_PATH = path.join(DATA_DIR, "case-001.seed.json");

/**
 * POST /api/demo/reset
 * Restores case-001 to its seed state (REPRODUCED with patch proposed).
 */
demoRouter.post("/reset", (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!fs.existsSync(SEED_PATH)) {
      res.status(500).json({
        error: "Seed file not found",
        details: `Expected at ${SEED_PATH}`,
      });
      return;
    }

    const seedRaw = fs.readFileSync(SEED_PATH, "utf-8");
    const seed = JSON.parse(seedRaw) as BugCase;

    // Reset timestamps to now so the demo feels live
    const now = new Date().toISOString();
    seed.updatedAt = now;

    writeCase(seed);

    // Re-read and return the written case
    const reset = readCase("case-001");
    res.json(reset);
    console.log("[demo] case-001 reset to seed state");
  } catch (err) {
    next(err);
  }
});
