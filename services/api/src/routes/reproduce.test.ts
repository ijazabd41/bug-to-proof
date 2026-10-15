import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { reproduceRouter } from "./reproduce";

const mockReadCase = vi.fn();
vi.mock("../storage/caseStore", () => ({
  readCase: (...args: unknown[]) => mockReadCase(...args),
  writeCase: vi.fn(),
}));
vi.mock("../runner/playwrightRunner", () => ({ runTest: vi.fn() }));
vi.mock("../llm/client", () => ({ callLLM: vi.fn() }));

const app = express().use(express.json()).use("/api/cases", reproduceRouter);

describe("configured reproduction boundary", () => {
  beforeEach(() => {
    mockReadCase.mockReturnValue({
      id: "case-new-report",
      status: "REPORTED",
      reproduction: { testFile: "" },
    });
  });

  it("refuses a new case without invoking the evidence runner", async () => {
    const res = await request(app).post("/api/cases/case-new-report/reproduce");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Case has no trusted reproduction test",
      code: "REPRODUCTION_TEST_REQUIRED",
      details: "Automatic reproduction generation is not available yet; configure reproduction.testFile to use the existing workflow",
    });
  });
});
