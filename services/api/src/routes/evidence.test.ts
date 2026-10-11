import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import seed from "./legacy-case.fixture.json";

const mocks = vi.hoisted(() => ({ current: null as any, run: vi.fn() }));
vi.mock("../storage/caseStore", () => ({
  readCase: () => mocks.current,
  writeCase: (value: any) => { mocks.current = value; },
}));
vi.mock("../runner/playwrightRunner", async (original) => ({
  ...await original<any>(), runTest: mocks.run,
}));
vi.mock("../llm/client", () => ({ callLLM: vi.fn().mockResolvedValue(null) }));
import { reproduceRouter } from "./reproduce";
import { verifyRouter } from "./verify";

const app = express().use(express.json()).use(reproduceRouter).use(verifyRouter);
beforeEach(() => {
  mocks.current = structuredClone(seed);
  mocks.current.status = "PATCH_APPLIED";
  mocks.run.mockReset();
});

describe("evidence gates", () => {
  it("does not reproduce a bug when MiniShop is unreachable", async () => {
    mocks.run.mockResolvedValue({ passed: false, outcome: "INFRASTRUCTURE_ERROR", actual: "MiniShop unreachable", durationMs: 0, artifactPaths: {} });
    expect((await request(app).post("/case-001/reproduce")).status).toBe(202);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mocks.current.status).toBe("REPRODUCTION_FAILED");
    expect(mocks.current.verification.beforeRun.outcome).toBe("INFRASTRUCTURE_ERROR");
  });

  it.each([null, { passed: true }, { passed: false }, { passed: false, outcome: "INFRASTRUCTURE_ERROR" }])(
    "rejects verification without a recorded assertion failure (%j)", async (baseline) => {
      mocks.current.verification.beforeRun = baseline;
      const response = await request(app).post("/case-001/verify");
      expect(response.status).toBe(409);
      expect(mocks.run).not.toHaveBeenCalled();
    },
  );

  it("rejects a baseline from a different test fingerprint", async () => {
    mocks.current.verification.beforeRun = {
      passed: false, outcome: "ASSERTION_FAILED", testFingerprint: "changed-test",
      evidenceIds: ["ev-case-001-before-result"],
    };
    expect((await request(app).post("/case-001/verify")).status).toBe(409);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});

