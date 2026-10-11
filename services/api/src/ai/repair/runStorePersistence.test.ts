import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import request from "supertest";
import app from "../../index";
import {
  saveRunRecord,
  getRunRecord,
  listRunRecords,
  recoverInterruptedRuns,
  appendRunEvent,
  getRunFilePath,
  getRunsDir,
  RunStorageError,
  CorruptRunRecordError,
} from "./runStore";
import type { RepairRunRecord } from "./contracts";
import { rimrafDir } from "../../utils/rimraf";

describe("Repair Run Persistence Reliability & Integrity", () => {
  const createdDirs: string[] = [];

  function getUniqueRunId(prefix: string): string {
    const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    createdDirs.push(path.join(getRunsDir(), id));
    return id;
  }

  function makeRecord(id: string, state: RepairRunRecord["state"] = "INITIALIZING"): RepairRunRecord {
    return {
      schemaVersion: "1.0",
      runId: id,
      caseId: "case-001",
      mode: "dynamic",
      state,
      attempt: 1,
      maxAttempts: 3,
      originalSourceFingerprint: "fp-orig",
      targetSnapshotDir: "",
      testFingerprint: "fp-test",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const cleanupDirs = () => {
    vi.restoreAllMocks();
    while (createdDirs.length > 0) {
      const d = createdDirs.pop();
      if (d && fs.existsSync(d)) {
        try {
          rimrafDir(d);
        } catch {
          // ignore
        }
      }
    }
  };

  afterEach(() => {
    cleanupDirs();
  });

  afterAll(() => {
    cleanupDirs();
  });

  it("preserves previous valid run record byte-for-byte when atomic rename fails (no overwrite fallback)", () => {
    const testRunId = getUniqueRunId("test-persist");
    const originalRecord = makeRecord(testRunId, "INITIALIZING");
    originalRecord.originalSourceFingerprint = "PRISTINE_SOURCE_DATA_12345";
    saveRunRecord(originalRecord);

    const runFilePath = getRunFilePath(testRunId);
    const originalFileBytes = fs.readFileSync(runFilePath, "utf-8");

    // Mock ONLY renameSync to fail with EBUSY (leave copyFileSync unmocked/functional)
    const copySpy = vi.spyOn(fs, "copyFileSync");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      const err: any = new Error("EBUSY: resource busy or locked");
      err.code = "EBUSY";
      throw err;
    });

    const modifiedRecord = {
      ...originalRecord,
      originalSourceFingerprint: "CORRUPTED_MUTATION",
    };

    // saveRunRecord must throw RunStorageError without attempting unsafe copy overwrite
    expect(() => saveRunRecord(modifiedRecord)).toThrow(RunStorageError);
    expect(copySpy).not.toHaveBeenCalled();

    // Verify existing record is byte-for-byte identical to original
    const postFailureBytes = fs.readFileSync(runFilePath, "utf-8");
    expect(postFailureBytes).toBe(originalFileBytes);

    // Verify no temporary files left behind
    const dirEntries = fs.readdirSync(path.join(getRunsDir(), testRunId));
    const tmpFiles = dirEntries.filter((f) => f.startsWith(".tmp-") || f.endsWith(".tmp"));
    expect(tmpFiles).toHaveLength(0);

    copySpy.mockRestore();
  });

  it("preserves previous valid record and throws RunStorageError on EACCES or EPERM", () => {
    const testRunId = getUniqueRunId("test-eacces");
    const originalRecord = makeRecord(testRunId, "INITIALIZING");
    originalRecord.originalSourceFingerprint = "EACCES_INITIAL_DATA";
    saveRunRecord(originalRecord);

    const runFilePath = getRunFilePath(testRunId);
    const originalFileBytes = fs.readFileSync(runFilePath, "utf-8");

    const copySpy = vi.spyOn(fs, "copyFileSync");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      const err: any = new Error("EACCES: permission denied");
      err.code = "EACCES";
      throw err;
    });

    expect(() => saveRunRecord({ ...originalRecord, originalSourceFingerprint: "MUTATED" })).toThrow(RunStorageError);
    expect(copySpy).not.toHaveBeenCalled();

    const postFailureBytes = fs.readFileSync(runFilePath, "utf-8");
    expect(postFailureBytes).toBe(originalFileBytes);

    copySpy.mockRestore();
  });

  it("distinguishes missing records (returns null) from corrupt records (throws CorruptRunRecordError)", () => {
    const corruptRunId = getUniqueRunId("test-corrupt");

    // 1. Missing record returns null
    const missing = getRunRecord(`missing-${Date.now()}`);
    expect(missing).toBeNull();

    // 2. Corrupt record throws CorruptRunRecordError
    const corruptFilePath = getRunFilePath(corruptRunId);
    fs.writeFileSync(corruptFilePath, "{ invalid json data", "utf-8");

    expect(() => getRunRecord(corruptRunId)).toThrow(CorruptRunRecordError);
  });

  it("throws CorruptRunRecordError on listRunRecords when corrupt files exist", () => {
    const corruptRunId = getUniqueRunId("test-corrupt-list");
    const corruptFilePath = getRunFilePath(corruptRunId);
    fs.writeFileSync(corruptFilePath, "{ corrupted json payload", "utf-8");

    expect(() => listRunRecords()).toThrow(CorruptRunRecordError);
  });

  it("returns explicit 404 for missing runs and 500 for corrupt runs via API", async () => {
    const corruptRunId = getUniqueRunId("test-corrupt-api");

    // 1. Missing run -> 404
    const resMissing = await request(app).get(`/api/ai/repair-runs/nonexistent-run-id`);
    expect(resMissing.status).toBe(404);
    expect(resMissing.body.error).toContain("not found");

    // 2. Corrupt run -> 500
    const corruptFilePath = getRunFilePath(corruptRunId);
    fs.writeFileSync(corruptFilePath, "{ corrupted payload", "utf-8");

    const resCorrupt = await request(app).get(`/api/ai/repair-runs/${corruptRunId}`);
    expect(resCorrupt.status).toBe(500);
    expect(resCorrupt.body.error).toContain("Corrupt");

    // 3. Listing with corrupt run -> 500
    const resList = await request(app).get(`/api/ai/repair-runs`);
    expect(resList.status).toBe(500);
    expect(resList.body.error).toContain("Corrupt");
  });

  it("startup recovery recovers valid active runs, preserves AWAITING_REVIEW runs, and leaves corrupt runs intact", () => {
    const corruptRunId = getUniqueRunId("test-corrupt-rec");
    const interruptedRunId = getUniqueRunId("test-interrupted");
    const awaitingRunId = getUniqueRunId("test-awaiting");

    // 1. Create a corrupt run
    const corruptFilePath = getRunFilePath(corruptRunId);
    fs.writeFileSync(corruptFilePath, "{ broken json", "utf-8");

    // 2. Create an active run needing recovery
    const activeRecord = makeRecord(interruptedRunId, "REPRODUCING_BASELINE");
    saveRunRecord(activeRecord);

    // 3. Create an AWAITING_REVIEW run (must stay AWAITING_REVIEW)
    const awaitingRecord = makeRecord(awaitingRunId, "AWAITING_REVIEW");
    awaitingRecord.proposal = {
      schemaVersion: "1.0",
      proposalId: "prop-123",
      diagnosis: "diag",
      assumptions: [],
      rationale: "rat",
      edits: [],
      unifiedDiff: "diff",
      proposalHash: "a".repeat(64),
      proposedAt: new Date().toISOString(),
    };
    saveRunRecord(awaitingRecord);

    // Startup recovery must not throw on the corrupt record
    expect(() => recoverInterruptedRuns()).not.toThrow();

    // Corrupt file remains unchanged
    const corruptBytes = fs.readFileSync(corruptFilePath, "utf-8");
    expect(corruptBytes).toBe("{ broken json");

    // Active run was recovered to BLOCKED
    const activeFileRaw = fs.readFileSync(getRunFilePath(interruptedRunId), "utf-8");
    const activeLoaded = JSON.parse(activeFileRaw) as RepairRunRecord;
    expect(activeLoaded.state).toBe("BLOCKED");
    expect(activeLoaded.stopReason).toContain("interrupted");

    // AWAITING_REVIEW run was preserved
    const awaitingFileRaw = fs.readFileSync(getRunFilePath(awaitingRunId), "utf-8");
    const awaitingLoaded = JSON.parse(awaitingFileRaw) as RepairRunRecord;
    expect(awaitingLoaded.state).toBe("AWAITING_REVIEW");
    expect(awaitingLoaded.proposal?.proposalId).toBe("prop-123");
  });

  it("safely appends events without losing recorded events", () => {
    const testRunId = getUniqueRunId("test-append");
    const record = makeRecord(testRunId, "INVESTIGATING");
    saveRunRecord(record);

    appendRunEvent(testRunId, "stage-1", "Event 1 message", { detail: 1 });
    appendRunEvent(testRunId, "stage-2", "Event 2 message", { detail: 2 });
    appendRunEvent(testRunId, "stage-3", "Event 3 message", { detail: 3 });

    const loaded = getRunRecord(testRunId);
    expect(loaded?.events.length).toBe(3);
    expect(loaded?.events.map((e) => e.stage)).toEqual(["stage-1", "stage-2", "stage-3"]);
    expect(loaded?.events[2].data).toEqual({ detail: 3 });
  });

  it("preserves disk events when saving a stale in-memory run record", () => {
    const testRunId = getUniqueRunId("test-stale");
    const initial = makeRecord(testRunId, "INVESTIGATING");
    initial.events = [{ timestamp: "2026-10-09T00:00:00.000Z", stage: "stage-1", message: "Event 1" }];
    saveRunRecord(initial);

    // In-memory snapshot held by caller (only knows about Event 1)
    const inMemorySnapshot = getRunRecord(testRunId)!;

    // Interleaving event appended to disk while inMemorySnapshot was held
    appendRunEvent(testRunId, "stage-2", "Event 2 from concurrent logging", { detail: "concurrent" });

    // Caller updates other fields in inMemorySnapshot and saves
    inMemorySnapshot.state = "APPLYING";
    inMemorySnapshot.attempt = 2;
    saveRunRecord(inMemorySnapshot);

    // Loaded record must have BOTH events, not drop Event 2!
    const finalRecord = getRunRecord(testRunId)!;
    expect(finalRecord.state).toBe("APPLYING");
    expect(finalRecord.attempt).toBe(2);
    expect(finalRecord.events.length).toBe(2);
    expect(finalRecord.events.map((e) => e.stage)).toEqual(["stage-1", "stage-2"]);
  });
});
