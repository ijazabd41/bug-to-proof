import { describe, it, expect } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import app from "../index";
import { writeCase, deleteCase, readCase } from "../storage/caseStore";
import { saveRunRecord } from "../ai/repair/runStore";
import { ARTIFACTS_DIR } from "../utils/paths";
import { rimrafDir } from "../utils/rimraf";
import type { BugCase } from "@bug-to-proof/shared-types";
import type { RepairRunRecord } from "../ai/repair/contracts";

function safeCleanup(caseId: string, runId: string) {
  try {
    deleteCase(caseId);
  } catch {}
  try {
    const runDir = path.join(ARTIFACTS_DIR, "runs", runId);
    if (fs.existsSync(runDir)) {
      rimrafDir(runDir);
    }
  } catch {}
}

describe("Dynamic Repair Case Deletion & Edit Guard", () => {
  const ALL_ACTIVE_STATES: RepairRunRecord["state"][] = [
    "INITIALIZING",
    "REPRODUCING_BASELINE",
    "INVESTIGATING",
    "PROPOSING",
    "AWAITING_REVIEW",
    "APPLYING",
    "VERIFYING_REPRODUCTION",
    "RUNNING_CHECKS",
  ];

  const ALL_TERMINAL_STATES: RepairRunRecord["state"][] = [
    "VERIFIED",
    "VERIFICATION_FAILED",
    "REJECTED",
    "BLOCKED",
    "CANCELLED",
  ];

  for (const activeState of ALL_ACTIVE_STATES) {
    it(`prevents case deletion when dynamic repair run is in active state: ${activeState}`, async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stateCaseId = `case-guard-del-${activeState.toLowerCase().replace(/_/g, "-")}-${suffix}`;
      const stateRunId = `run-guard-del-${activeState.toLowerCase().replace(/_/g, "-")}-${suffix}`;

      const bugCase: BugCase = {
        id: stateCaseId,
        title: "Test Case",
        description: "Test Desc",
        status: "REPORTED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reproduction: {
          preconditions: [],
          steps: ["Step 1"],
          expected: "Exp",
          actual: "Act",
          testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
          lastRun: null,
        },
        patch: null,
        verification: null,
        evidence: [],
        rootCauseExplanation: null,
      };
      writeCase(bugCase);

      const activeRun: RepairRunRecord = {
        schemaVersion: "1.0",
        runId: stateRunId,
        caseId: stateCaseId,
        mode: "dynamic",
        state: activeState,
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        originalSourceFingerprint: "fp-1",
        targetSnapshotDir: "",
        testFingerprint: "fp-test-1",
        reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        requiredChecks: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveRunRecord(activeRun);

      try {
        const res = await request(app).delete(`/api/cases/${stateCaseId}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/active|running|repair/i);
        expect(readCase(stateCaseId)).not.toBeNull();
      } finally {
        safeCleanup(stateCaseId, stateRunId);
      }
    }, 15_000);

    it(`prevents case editing when dynamic repair run is in active state: ${activeState}`, async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stateCaseId = `case-guard-edit-${activeState.toLowerCase().replace(/_/g, "-")}-${suffix}`;
      const stateRunId = `run-guard-edit-${activeState.toLowerCase().replace(/_/g, "-")}-${suffix}`;

      const bugCase: BugCase = {
        id: stateCaseId,
        title: "Test Case",
        description: "Test Desc",
        status: "REPORTED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reproduction: {
          preconditions: [],
          steps: ["Step 1"],
          expected: "Exp",
          actual: "Act",
          testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
          lastRun: null,
        },
        patch: null,
        verification: null,
        evidence: [],
        rootCauseExplanation: null,
      };
      writeCase(bugCase);

      const activeRun: RepairRunRecord = {
        schemaVersion: "1.0",
        runId: stateRunId,
        caseId: stateCaseId,
        mode: "dynamic",
        state: activeState,
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        originalSourceFingerprint: "fp-1",
        targetSnapshotDir: "",
        testFingerprint: "fp-test-1",
        reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        requiredChecks: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveRunRecord(activeRun);

      try {
        const res = await request(app).patch(`/api/cases/${stateCaseId}`).send({ title: "Renamed Title" });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/active|running|repair/i);
      } finally {
        safeCleanup(stateCaseId, stateRunId);
      }
    }, 15_000);
  }

  for (const terminalState of ALL_TERMINAL_STATES) {
    it(`allows case deletion when dynamic repair run is in terminal state: ${terminalState}`, async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stateCaseId = `case-guard-term-${terminalState.toLowerCase().replace(/_/g, "-")}-${suffix}`;
      const stateRunId = `run-guard-term-${terminalState.toLowerCase().replace(/_/g, "-")}-${suffix}`;

      const bugCase: BugCase = {
        id: stateCaseId,
        title: "Test Case",
        description: "Test Desc",
        status: "REPORTED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reproduction: {
          preconditions: [],
          steps: ["Step 1"],
          expected: "Exp",
          actual: "Act",
          testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
          lastRun: null,
        },
        patch: null,
        verification: null,
        evidence: [],
        rootCauseExplanation: null,
      };
      writeCase(bugCase);
      expect(readCase(stateCaseId)).not.toBeNull();

      const completedRun: RepairRunRecord = {
        schemaVersion: "1.0",
        runId: stateRunId,
        caseId: stateCaseId,
        mode: "dynamic",
        state: terminalState,
        attempt: 1,
        maxAttempts: 3,
        attempts: [],
        originalSourceFingerprint: "fp-1",
        targetSnapshotDir: "",
        testFingerprint: "fp-test-1",
        reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        requiredChecks: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      saveRunRecord(completedRun);

      try {
        const res = await request(app).delete(`/api/cases/${stateCaseId}`);
        if (res.status !== 204) {
          console.error(`[Test Debug] DELETE /api/cases/${stateCaseId} failed with ${res.status}:`, res.body);
        }
        expect(res.status).toBe(204);
        expect(readCase(stateCaseId)).toBeNull();
      } finally {
        safeCleanup(stateCaseId, stateRunId);
      }
    }, 15_000);
  }
});
