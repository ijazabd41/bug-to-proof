import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../index";
import { writeCase, deleteCase } from "../storage/caseStore";
import { getRunRecord } from "../ai/repair/runStore";
import type { BugCase } from "@bug-to-proof/shared-types";

describe("Async Repair Start & Prompt Run ID Return", () => {
  const testCaseId = "case-test-async-start";

  beforeEach(() => {
    const testCase: BugCase = {
      id: testCaseId,
      title: "Sample calculation defect",
      description: "Calculation defect in shopping cart",
      status: "READY_TO_REPRODUCE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reproduction: {
        preconditions: [],
        steps: [],
        expected: "Correct calculation",
        actual: "Incorrect calculation",
        testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        lastRun: null,
      },
      patch: null,
      verification: null,
      evidence: [],
      rootCauseExplanation: null,
    };
    writeCase(testCase);
  });

  afterEach(() => {
    deleteCase(testCaseId);
  });

  it("POST /api/ai/cases/:id/repair-runs returns 201 immediately with a persisted run ID", async () => {
    const start = Date.now();
    const res = await request(app)
      .post(`/api/ai/cases/${testCaseId}/repair-runs`)
      .send({ maxAttempts: 1 });

    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(201);
    expect(res.body.runId).toBeDefined();
    expect(res.body.runId).toMatch(/^run-[a-zA-Z0-9-]+$/);
    expect(res.body.caseId).toBe(testCaseId);
    expect(["INITIALIZING", "REPRODUCING_BASELINE", "PROPOSING", "AWAITING_REVIEW", "BLOCKED"]).toContain(res.body.state);

    // The run ID must be persisted in runStore immediately
    const saved = getRunRecord(res.body.runId);
    expect(saved).not.toBeNull();
    expect(saved?.runId).toBe(res.body.runId);

    // The HTTP response should return promptly (under 3000ms, not blocking for full multi-minute run)
    expect(elapsedMs).toBeLessThan(3000);
  });
});
