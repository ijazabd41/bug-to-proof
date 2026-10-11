import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  saveRunRecord,
  getRunRecord,
  appendRunEvent,
  recoverInterruptedRuns,
} from "./runStore";
import type { RepairRunRecord } from "./contracts";
import { ARTIFACTS_DIR } from "../../utils/paths";

describe("Dynamic AI Repair RunStore", () => {
  const testRunId = "test-run-" + Date.now();
  const testRunDir = path.join(ARTIFACTS_DIR, "runs", testRunId);

  afterEach(() => {
    if (fs.existsSync(testRunDir)) {
      fs.rmSync(testRunDir, { recursive: true, force: true });
    }
  });

  it("saves and retrieves a run record atomically", () => {
    const record: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: "case-001",
      mode: "dynamic",
      state: "INITIALIZING",
      attempt: 1,
      maxAttempts: 3,
      originalSourceFingerprint: "fingerprint-123",
      targetSnapshotDir: "some/path",
      testFingerprint: "test-fp-123",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRunRecord(record);
    const loaded = getRunRecord(testRunId);
    expect(loaded).not.toBeNull();
    expect(loaded?.runId).toBe(testRunId);
    expect(loaded?.state).toBe("INITIALIZING");
  });

  it("appends events to a run record", () => {
    const record: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: "case-001",
      mode: "dynamic",
      state: "INITIALIZING",
      attempt: 1,
      maxAttempts: 3,
      originalSourceFingerprint: "fingerprint-123",
      targetSnapshotDir: "some/path",
      testFingerprint: "test-fp-123",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRunRecord(record);
    appendRunEvent(testRunId, "investigation", "Found target file", { file: "cartStore.ts" });

    const updated = getRunRecord(testRunId);
    expect(updated?.events.length).toBe(1);
    expect(updated?.events[0].message).toBe("Found target file");
    expect(updated?.events[0].stage).toBe("investigation");
  });

  it("recovers interrupted runs by setting them to BLOCKED", () => {
    const record: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: "case-001",
      mode: "dynamic",
      state: "REPRODUCING_BASELINE",
      attempt: 1,
      maxAttempts: 3,
      originalSourceFingerprint: "fingerprint-123",
      targetSnapshotDir: "some/path",
      testFingerprint: "test-fp-123",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRunRecord(record);
    recoverInterruptedRuns();

    const recovered = getRunRecord(testRunId);
    expect(recovered?.state).toBe("BLOCKED");
    expect(recovered?.stopReason).toContain("interrupted");
  });
});
