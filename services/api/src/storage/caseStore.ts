import fs from "fs";
import path from "path";
import type { BugCase, BugReportDetails } from "@bug-to-proof/shared-types";
import { DATA_DIR } from "../utils/paths";
import { validateCaseId } from "../validation/caseValidation";
import { assessReportCompleteness } from "../reproduction/reportCompleteness";

export function normalizeCaseRecord(input: BugCase): BugCase {
  const bugCase = structuredClone(input);
  const report: BugReportDetails = bugCase.report ?? {
    schemaVersion: "1.0",
    steps: bugCase.reproduction?.steps ? [...bugCase.reproduction.steps] : [],
    expected: bugCase.reproduction?.expected ?? "",
    actual: bugCase.reproduction?.actual ?? "",
    startPath: "",
    context: "",
  };
  bugCase.report = report;
  bugCase.reportCompleteness = assessReportCompleteness(report);
  return bugCase;
}

/** Ensure data/cases/ directory exists. */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function casePath(id: string): string {
  if (!validateCaseId(id)) throw new Error("Invalid case ID format");
  return path.join(DATA_DIR, `${id}.json`);
}

export class CorruptCaseRecordError extends Error {
  constructor(public filePath: string, public originalError: unknown) {
    super(`Corrupted case record at ${filePath}: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    this.name = "CorruptCaseRecordError";
  }
}

export class CaseStorageError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "CaseStorageError";
  }
}

/** Read a single BugCase by ID. Returns null if not found. Throws CorruptCaseRecordError if corrupt. */
export function readCase(id: string): BugCase | null {
  if (!validateCaseId(id)) return null;
  const filePath = casePath(id);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return normalizeCaseRecord(JSON.parse(raw) as BugCase);
  } catch (err) {
    console.error(`[caseStore] Error reading case file ${filePath}: Corrupted or invalid JSON`);
    throw new CorruptCaseRecordError(filePath, err);
  }
}

/** Read all BugCases from data/cases/*.json. Throws CorruptCaseRecordError if any record is corrupt. */
export function readAllCases(): BugCase[] {
  ensureDataDir();
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".seed.json") && !f.includes(".tmp"));

  const results: BugCase[] = [];
  for (const f of files) {
    const fullPath = path.join(DATA_DIR, f);
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = normalizeCaseRecord(JSON.parse(raw) as BugCase);
      results.push(parsed);
    } catch (err) {
      console.error(`[caseStore] Corrupt case record detected in file: ${fullPath}`);
      throw new CorruptCaseRecordError(fullPath, err);
    }
  }
  return results;
}

/**
 * Atomically write a BugCase to disk.
 * Writes to a unique .tmp file first, then atomically renames to ensure consistency.
 * If atomic replacement fails, preserves previous record, unlinks temporary file,
 * and throws a retryable CaseStorageError without blocking the event loop.
 */
export function writeCase(bugCase: BugCase): void {
  ensureDataDir();
  const filePath = casePath(bugCase.id);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;

  fs.writeFileSync(tmpPath, JSON.stringify(bugCase, null, 2), "utf-8");

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err: any) {
    let replaced = false;
    if (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") {
      try {
        fs.copyFileSync(tmpPath, filePath);
        replaced = true;
      } catch {}
    }

    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}

    if (!replaced) {
      throw new CaseStorageError(
        `Failed to atomically persist case ${bugCase.id}: ${err?.message || "Atomic rename failed"}`,
        err
      );
    }
  }
}

function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

/** Delete a case file. Returns true if deleted, false if not found. */
export function deleteCase(id: string): boolean {
  if (!validateCaseId(id)) return false;
  const filePath = casePath(id);
  if (!fs.existsSync(filePath)) return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (!fs.existsSync(filePath)) return true;
      fs.unlinkSync(filePath);
      return true;
    } catch (err: any) {
      if (err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES") {
        if (attempt < 4) {
          sleepSync(15 * (attempt + 1));
          continue;
        }
      }
      return false;
    }
  }
  return !fs.existsSync(filePath);
}

function reconcileSingleCase(bugCase: BugCase, write: (c: BugCase) => void): void {
  if (bugCase.status === "REPRODUCING") {
    bugCase.status = "REPRODUCTION_FAILED";
    bugCase.updatedAt = new Date().toISOString();
    write(bugCase);
    console.log(`[caseStore] Reconciled interrupted case ${bugCase.id} from REPRODUCING to REPRODUCTION_FAILED`);
  } else if (bugCase.status === "VERIFYING") {
    bugCase.status = "VERIFICATION_FAILED";
    if (bugCase.verification) {
      bugCase.verification.status = "VERIFICATION_FAILED";
    }
    bugCase.updatedAt = new Date().toISOString();
    write(bugCase);
    console.log(`[caseStore] Reconciled interrupted case ${bugCase.id} from VERIFYING to VERIFICATION_FAILED`);
  }
}

/**
 * Reconcile any legacy cases stuck in transient running states (REPRODUCING, VERIFYING)
 * after a process restart without inventing fake execution outcomes.
 * Scans disk records directly and tolerates corrupt files during startup so the API
 * stays available and corrupt files are preserved intact.
 */
export function recoverInterruptedLegacyCases(allCases?: BugCase[], writer?: (c: BugCase) => void): void {
  const write = writer ?? writeCase;
  if (allCases) {
    for (const bugCase of allCases) {
      reconcileSingleCase(bugCase, write);
    }
    return;
  }

  ensureDataDir();
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".seed.json") && !f.includes(".tmp"));

  for (const f of files) {
    const fullPath = path.join(DATA_DIR, f);
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const bugCase = JSON.parse(raw) as BugCase;
      reconcileSingleCase(bugCase, write);
    } catch (err) {
      console.warn(`[caseStore] Corrupt case record at ${fullPath}; skipping startup reconciliation and preserving file intact`);
    }
  }
}
