import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../index";
import { writeCase, deleteCase } from "../storage/caseStore";
import type { BugCase } from "@bug-to-proof/shared-types";

describe("AI Dynamic Repair API Routes", () => {
  const testCaseId = "case-api-test-dynamic";

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

  it("GET /api/ai/repair-runs returns array of runs", async () => {
    const res = await request(app).get("/api/ai/repair-runs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/ai/repair-runs/:runId returns 404 for unknown run", async () => {
    const res = await request(app).get("/api/ai/repair-runs/unknown-run-id-999");
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/cases/:id/repair-runs validates case ID and existence", async () => {
    const resNotFound = await request(app).post("/api/ai/cases/non-existent-case-123/repair-runs");
    expect(resNotFound.status).toBe(404);

    const resInvalid = await request(app).post("/api/ai/cases/invalid$$$case/repair-runs");
    expect(resInvalid.status).toBe(400);
  });

  it("refuses dynamic repair for a newly created case without a trusted reproduction test", async () => {
    const testlessId = "case-api-test-testless";
    writeCase({
      ...structuredClone((await request(app).get(`/api/cases/${testCaseId}`)).body),
      id: testlessId,
      status: "REPORTED",
      reproduction: { preconditions: [], steps: [], expected: "", actual: "", testFile: "", lastRun: null },
    });

    try {
      const res = await request(app).post(`/api/ai/cases/${testlessId}/repair-runs`);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: "Case does not have a configured reproduction test",
        code: "REPRODUCTION_TEST_REQUIRED",
      });
    } finally {
      deleteCase(testlessId);
    }
  });

  it("POST /api/ai/repair-runs/:runId/review validates required fields", async () => {
    const res = await request(app)
      .post("/api/ai/repair-runs/any-run/review")
      .send({ proposalId: "prop-1" }); // missing proposalHash & decision

    expect(res.status).toBe(400);
  });

  it("GET /api/ai/repair-runs/:runId/bundle.zip returns 404 for unknown run and 400 for invalid ID", async () => {
    const res404 = await request(app).get("/api/ai/repair-runs/unknown-run-id-999/bundle.zip");
    expect(res404.status).toBe(404);

    const res400 = await request(app).get("/api/ai/repair-runs/invalid$$$run/bundle.zip");
    expect(res400.status).toBe(400);
  });
});
