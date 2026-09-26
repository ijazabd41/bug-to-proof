import fs from "fs";
import path from "path";
import type { BugCase } from "@bug-to-proof/shared-types";
import { DATA_DIR } from "../utils/paths";

/** Ensure data/cases/ directory exists. */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function casePath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

/** Read a single BugCase by ID. Returns null if not found. */
export function readCase(id: string): BugCase | null {
  const filePath = casePath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as BugCase;
  } catch {
    return null;
  }
}

/** Read all BugCases from data/cases/*.json. */
export function readAllCases(): BugCase[] {
  ensureDataDir();
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".seed.json"));
  return files
    .map((f) => {
      try {
        const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
        return JSON.parse(raw) as BugCase;
      } catch {
        return null;
      }
    })
    .filter((c): c is BugCase => c !== null);
}

/**
 * Atomically write a BugCase to disk.
 * Writes to a .tmp file first, then renames to ensure consistency.
 */
export function writeCase(bugCase: BugCase): void {
  ensureDataDir();
  const filePath = casePath(bugCase.id);
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(bugCase, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/** Delete a case file. Returns true if deleted, false if not found. */
export function deleteCase(id: string): boolean {
  const filePath = casePath(id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
