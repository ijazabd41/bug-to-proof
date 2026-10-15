import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

let currentCase: any;
let writtenCase: any;
vi.mock("../storage/caseStore", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  readCase: () => currentCase,
  writeCase: (value: any) => { writtenCase = structuredClone(value); },
}));
import { reproductionReviewService, reproductionRunsRouter, reproductionRunStore, reproductionService } from "./reproductionRuns";

import { CorruptReproductionRunError } from "../reproduction/reproductionRunStore";
import { errorHandler } from "../middleware/errorHandler";

const app = express().use(express.json()).use("/api", reproductionRunsRouter).use(errorHandler);
const completeCase = {
  id: "case-api", title: "Cart total", description: "Wrong total",
  report: { schemaVersion: "1.0", steps: ["Add item"], expected: "$20", actual: "$10", startPath: "/", context: "" },
  reportCompleteness: { complete: true, missingFields: [] },
};

describe("reproduction run API", () => {
  beforeEach(() => { currentCase = structuredClone(completeCase); writtenCase = undefined; vi.restoreAllMocks(); });

  it("returns 202 and starts asynchronous generation for complete reports", async () => {
    const run = vi.spyOn(reproductionService, "run").mockResolvedValue({} as never);
    const response = await request(app).post("/api/cases/case-api/reproduction-runs").send();
    expect(response.status).toBe(202); expect(response.body).toMatchObject({ caseId: "case-api", state: "DISCOVERING_TARGET" });
    expect(response.body.reproductionRunId).toMatch(/^[0-9a-f-]+$/); expect(run).toHaveBeenCalledOnce();
  });

  it("refuses incomplete reports with precise missing details", async () => {
    currentCase.reportCompleteness = { complete: false, missingFields: ["expected", "actual"] };
    const run = vi.spyOn(reproductionService, "run");
    const response = await request(app).post("/api/cases/case-api/reproduction-runs").send();
    expect(response.status).toBe(409); expect(response.body).toMatchObject({ code: "REPORT_DETAILS_REQUIRED", details: "expected, actual" });
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 404 when case does not exist", async () => {
    currentCase = null;
    const response = await request(app).post("/api/cases/missing/reproduction-runs").send();
    expect(response.status).toBe(404);
  });

  it("lists and reads durable runs", async () => {
    vi.spyOn(reproductionRunStore, "listForCase").mockReturnValue([{ reproductionRunId: "run-1" }] as never);
    vi.spyOn(reproductionRunStore, "read").mockReturnValue({ reproductionRunId: "run-1", state: "AWAITING_TEST_REVIEW" } as never);
    expect((await request(app).get("/api/cases/case-api/reproduction-runs")).body).toHaveLength(1);
    const response = await request(app).get("/api/reproduction-runs/run-1");
    expect(response.status).toBe(200); expect(response.body.state).toBe("AWAITING_TEST_REVIEW");
  });

  it("returns 404 when reading non-existent run", async () => {
    vi.spyOn(reproductionRunStore, "read").mockReturnValue(null);
    const response = await request(app).get("/api/reproduction-runs/missing-run");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "REPRODUCTION_RUN_NOT_FOUND" });
  });

  it("returns 500 when reading a corrupt run record", async () => {
    vi.spyOn(reproductionRunStore, "read").mockImplementation(() => {
      throw new CorruptReproductionRunError("bad.json", new Error("bad json"));
    });
    const response = await request(app).get("/api/reproduction-runs/run-corrupt");
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Corrupt reproduction run record on disk");
  });

  it("handles run cancellation correctly across active and inactive states", async () => {
    vi.spyOn(reproductionRunStore, "read").mockReturnValue({ reproductionRunId: "run-inactive" } as never);
    const inactiveRes = await request(app).post("/api/reproduction-runs/run-inactive/cancel").send();
    expect(inactiveRes.status).toBe(409);
    expect(inactiveRes.body.code).toBe("REPRODUCTION_RUN_CONFLICT");

    vi.spyOn(reproductionRunStore, "read").mockReturnValue(null);
    const missingRes = await request(app).post("/api/reproduction-runs/missing/cancel").send();
    expect(missingRes.status).toBe(404);
  });

  it("persists cancellation before responding and makes repeated cancellation idempotent", async () => {
    let finish!: () => void; const pending = new Promise<any>(resolve => { finish = () => resolve({}); });
    vi.spyOn(reproductionService, "run").mockReturnValue(pending);
    const started = await request(app).post("/api/cases/case-api/reproduction-runs").send(); const id = started.body.reproductionRunId;
    const run: any = { schemaVersion: "1.0", reproductionRunId: id, caseId: "case-api", state: "GENERATING_CANDIDATE", reportSnapshot: {}, attempts: [], events: [],
      limits: { maxAttempts: 3, maxSteps: 20, maxRuntimeMs: 1, maxDefinitionBytes: 1, maxDiagnosticBytes: 100 }, createdAt: "x", updatedAt: "x" };
    vi.spyOn(reproductionRunStore, "read").mockImplementation(() => run);
    vi.spyOn(reproductionRunStore, "write").mockImplementation(value => Object.assign(run, value));
    expect((await request(app).post(`/api/reproduction-runs/${id}/cancel`).send()).status).toBe(202);
    expect((await request(app).get(`/api/reproduction-runs/${id}`)).body).toMatchObject({ state: "CANCELLED", completedAt: expect.any(String) });
    expect((await request(app).post(`/api/reproduction-runs/${id}/cancel`).send()).status).toBe(200);
    finish();
  });

  it("hash-binds approval, confirms the frozen baseline, and promotes the accepted test to the case", async () => {
    const candidate = { reproductionRunId: "run-review", caseId: "case-api", state: "AWAITING_TEST_REVIEW" } as any;
    vi.spyOn(reproductionRunStore, "read").mockReturnValue(candidate);
    vi.spyOn(reproductionReviewService, "review").mockResolvedValue({ ...candidate, state: "REPRODUCED",
      targetSnapshot: { sourceFingerprint: "c".repeat(64) },
      acceptedCandidate: { frozenTestPath: "C:/accepted/run-review/reproduction.spec.ts", definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64), acceptedAt: "now", acceptedBy: "reviewer" },
      baselineRun: { outcome: "ASSERTION_FAILED", passed: false, expected: "20", actual: "10", durationMs: 1, runAt: "now", evidenceIds: [] } } as never);
    const response = await request(app).post("/api/reproduction-runs/run-review/review").send({ decision: "APPROVE",
      definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64), acceptedBy: "reviewer" });
    expect(response.status).toBe(200); expect(response.body.state).toBe("REPRODUCED");
    expect(reproductionReviewService.review).toHaveBeenCalledWith(expect.objectContaining({ definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64), acceptedBy: "reviewer" }));
    expect(writtenCase).toMatchObject({ status: "REPRODUCED", reproduction: { testFile: "C:/accepted/run-review/reproduction.spec.ts", lastRun: { outcome: "ASSERTION_FAILED" } } });
  });

  it("rejects malformed review requests before changing durable state", async () => {
    vi.spyOn(reproductionRunStore, "read").mockReturnValue({ reproductionRunId: "run-review", caseId: "case-api" } as never);
    const review = vi.spyOn(reproductionReviewService, "review");
    const response = await request(app).post("/api/reproduction-runs/run-review/review").send({ decision: "APPROVE", definitionHash: "stale" });
    expect(response.status).toBe(400); expect(review).not.toHaveBeenCalled(); expect(writtenCase).toBeUndefined();
  });
});
