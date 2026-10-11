import fs from "fs";
import path from "path";
import { ARTIFACTS_DIR } from "../../utils/paths";
import { type RepairRunRecord, type RepairEvent, isActiveRepairState } from "./contracts";

export function getRunsDir(): string {
  const dir = path.join(ARTIFACTS_DIR, "runs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getRunFilePath(runId: string): string {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) {
    throw new Error("Invalid run ID");
  }
  const runDir = path.join(getRunsDir(), runId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }
  return path.join(runDir, "run.json");
}

export class RunStorageError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "RunStorageError";
  }
}

export class CorruptRunRecordError extends Error {
  constructor(public filePath: string, public originalError: unknown) {
    super(`Corrupted run record at ${filePath}: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    this.name = "CorruptRunRecordError";
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

export function saveRunRecord(record: RepairRunRecord): void {
  const filePath = getRunFilePath(record.runId);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  record.updatedAt = new Date().toISOString();

  // Merge disk events to prevent stale in-memory snapshots from discarding concurrent events
  if (fs.existsSync(filePath)) {
    try {
      const diskContent = fs.readFileSync(filePath, "utf-8");
      const diskRecord = JSON.parse(diskContent) as RepairRunRecord;
      if (Array.isArray(diskRecord.events) && diskRecord.events.length > 0) {
        const existingEvents = Array.isArray(record.events) ? record.events : [];
        const seen = new Set(existingEvents.map((e) => `${e.timestamp}::${e.stage}::${e.message}`));
        const merged = [...existingEvents];
        for (const diskEvent of diskRecord.events) {
          const key = `${diskEvent.timestamp}::${diskEvent.stage}::${diskEvent.message}`;
          if (!seen.has(key)) {
            merged.push(diskEvent);
            seen.add(key);
          }
        }
        merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        record.events = merged;
      }
    } catch {
      // If disk read fails or is invalid JSON during initial writes, proceed with in-memory record
    }
  }

  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf-8");

  let renamed = false;
  let lastError: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      renamed = true;
      break;
    } catch (err: any) {
      lastError = err;
      if (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") {
        if (attempt < 4) {
          sleepSync(15 * (attempt + 1));
          continue;
        }
      }
      break;
    }
  }

  if (!renamed) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}

    throw new RunStorageError(
      `Failed to atomically persist repair run ${record.runId}: ${lastError?.message || "Atomic rename failed"}`,
      lastError
    );
  }
}

export function getRunRecord(runId: string): RepairRunRecord | null {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) {
    return null;
  }
  const filePath = getRunFilePath(runId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as RepairRunRecord;
  } catch (err) {
    console.error(`[runStore] Error reading run record at ${filePath}: Corrupted or invalid JSON`);
    throw new CorruptRunRecordError(filePath, err);
  }
}

export function appendRunEvent(
  runId: string,
  stage: string,
  message: string,
  data?: Record<string, unknown>
): RepairRunRecord | null {
  const record = getRunRecord(runId);
  if (!record) return null;

  const event: RepairEvent = {
    timestamp: new Date().toISOString(),
    stage,
    message,
    ...(data ? { data } : {}),
  };

  record.events.push(event);
  saveRunRecord(record);
  return record;
}

export function listRunRecords(caseId?: string): RepairRunRecord[] {
  const runsDir = getRunsDir();
  const entries = fs.readdirSync(runsDir, { withFileTypes: true });
  let records: RepairRunRecord[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const runPath = path.join(runsDir, entry.name, "run.json");
      if (fs.existsSync(runPath)) {
        try {
          const content = fs.readFileSync(runPath, "utf-8");
          const record = JSON.parse(content) as RepairRunRecord;
          if (!caseId || record.caseId === caseId) {
            records.push(record);
          }
        } catch (err) {
          console.error(`[runStore] Corrupt run record detected in file: ${runPath}`);
          throw new CorruptRunRecordError(runPath, err);
        }
      }
    }
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return records;
}

export function recoverInterruptedRuns(): void {
  const runsDir = getRunsDir();
  const entries = fs.readdirSync(runsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const runPath = path.join(runsDir, entry.name, "run.json");
      if (fs.existsSync(runPath)) {
        try {
          const content = fs.readFileSync(runPath, "utf-8");
          const run = JSON.parse(content) as RepairRunRecord;
          if (isActiveRepairState(run.state) && run.state !== "AWAITING_REVIEW") {
            run.state = "BLOCKED";
            run.stopReason = "Process was interrupted before completion";
            run.completedAt = new Date().toISOString();
            saveRunRecord(run);
            appendRunEvent(
              run.runId,
              "recovery",
              "Recovered interrupted run after process restart. Marked as BLOCKED."
            );
            console.log(`[runStore] Reconciled interrupted run ${run.runId} to BLOCKED`);
          }
        } catch (err) {
          console.warn(`[runStore] Corrupt run record at ${runPath}; skipping startup recovery and preserving file intact`);
        }
      }
    }
  }
}
