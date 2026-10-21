import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import seed from "./legacy-case.fixture.json";
import { casesRouter } from "./cases";

let mockStore: Record<string, any> = {};

vi.mock("../storage/caseStore", () => ({
  readCase: (id: string) => mockStore[id] ? structuredClone(mockStore[id]) : null,
  readAllCases: () => Object.values(mockStore).map((c) => structuredClone(c)),
  writeCase: (bugCase: any) => { mockStore[bugCase.id] = structuredClone(bugCase); },
  deleteCase: (id: string) => {
    if (mockStore[id]) {
      delete mockStore[id];
      return true;
    }
    return false;
  },
}));

vi.mock("../llm/client", () => ({
  callLLM: vi.fn().mockResolvedValue(null),
}));

vi.mock("../ai/repair/runStore", () => ({
  listRunRecords: vi.fn().mockReturnValue([]),
}));

const app = express().use(express.json()).use("/api/cases", casesRouter);

describe("Cases API Validation & Hardening", () => {
  beforeEach(() => {
    mockStore = {
      "case-001": structuredClone(seed),
    };
  });

  describe("POST /api/cases (creation schema)", () => {
    it("stores structured report fields without concatenating them into description", async () => {
      const res = await request(app).post("/api/cases").send({
        title: "Cart total is wrong",
        description: "The total excludes later products",
        steps: ["Open the cart", "Add two products"],
        expected: "Both prices are included",
        actual: "Only the first price is included",
        startPath: "/cart",
        context: "Signed-in desktop user",
      });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe("The total excludes later products");
      expect(res.body.report).toEqual({
        schemaVersion: "1.0",
        steps: ["Open the cart", "Add two products"],
        expected: "Both prices are included",
        actual: "Only the first price is included",
        startPath: "/cart",
        context: "Signed-in desktop user",
      });
      expect(res.body.reportCompleteness).toEqual({ complete: true, missingFields: [] });
    });

    it("rejects new cases missing reproduction steps or either outcome", async () => {
      const base = { title: "Cart issue", description: "The cart looks wrong", steps: ["Open cart"], expected: "Both prices", actual: "Only one price" };
      for (const field of ["steps", "expected", "actual"] as const) {
        const body = { ...base, [field]: field === "steps" ? [] : "  " };
        const res = await request(app).post("/api/cases").send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(new RegExp(field, "i"));
      }
    });

    it("rejects creation with missing title", async () => {
      const res = await request(app).post("/api/cases").send({ description: "Some description" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title/i);
    });

    it("rejects creation with empty title or title exceeding max length", async () => {
      const resEmpty = await request(app).post("/api/cases").send({ title: "   ", description: "Valid desc" });
      expect(resEmpty.status).toBe(400);

      const resTooLong = await request(app).post("/api/cases").send({ title: "a".repeat(201), description: "Valid desc" });
      expect(resTooLong.status).toBe(400);
    });

    it("rejects creation with missing description or description exceeding max length", async () => {
      const resMissing = await request(app).post("/api/cases").send({ title: "Valid title" });
      expect(resMissing.status).toBe(400);

      const resTooLong = await request(app).post("/api/cases").send({ title: "Valid title", description: "a".repeat(5001) });
      expect(resTooLong.status).toBe(400);
    });

    it("rejects creation with runner-owned or unexpected injected fields", async () => {
      const res = await request(app).post("/api/cases").send({
        title: "Injected Bug",
        description: "Attempting to forge status",
        status: "VERIFIED",
        verification: { status: "VERIFIED" },
        evidence: [{ id: "fake" }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/runner-owned|unknown|forbidden/i);
    });

    it("generates collision-resistant IDs when created in rapid succession", async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const res = await request(app).post("/api/cases").send({
          title: `Case ${i}`,
          description: `Description ${i}`,
          steps: ["Open cart"],
          expected: "Both prices",
          actual: "Only one price",
        });
        expect(res.status).toBe(201);
        expect(ids.has(res.body.id)).toBe(false);
        ids.add(res.body.id);
      }
      expect(ids.size).toBe(50);
    });
  });

  describe("PATCH /api/cases/:id (update schema)", () => {
    it("updates report completeness after clarification", async () => {
      mockStore["case-001"].report = { schemaVersion: "1.0", steps: [], expected: "", actual: "", startPath: "", context: "" };
      const res = await request(app).patch("/api/cases/case-001").send({
        report: {
          schemaVersion: "1.0",
          steps: ["Open cart", "Add two products"],
          expected: "Both prices appear",
          actual: "One price appears",
          startPath: "/cart",
          context: "",
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.reportCompleteness).toEqual({ complete: true, missingFields: [] });
    });

    it("rejects external report starting paths", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        report: { schemaVersion: "1.0", steps: [], expected: "", actual: "", startPath: "https://example.com", context: "" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/application-relative path/i);
    });

    it("rejects malformed reproduction.steps (not an array)", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        reproduction: { steps: "just a string instead of array" },
      });
      expect(res.status).toBe(400);
      expect(mockStore["case-001"].reproduction.steps).toEqual(seed.reproduction.steps);
    });

    it("rejects malformed reproduction.steps containing non-string elements", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        reproduction: { steps: [123, { object: true }] },
      });
      expect(res.status).toBe(400);
      expect(mockStore["case-001"].reproduction.steps).toEqual(seed.reproduction.steps);
    });

    it("rejects malformed reproduction.preconditions containing non-string elements", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        reproduction: { preconditions: [null, 456] },
      });
      expect(res.status).toBe(400);
      expect(mockStore["case-001"].reproduction.preconditions).toEqual(seed.reproduction.preconditions);
    });

    it("rejects testFile path traversal or invalid path", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        reproduction: { testFile: "../../../etc/passwd" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects runner-owned top-level fields in PATCH", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        verification: { status: "VERIFIED" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/runner-owned|unknown|forbidden/i);
    });

    it("rejects unknown top-level fields in PATCH", async () => {
      const res = await request(app).patch("/api/cases/case-001").send({
        unknownProperty: "hacked",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unknown/i);
    });

    it("prevents deletion while case is in active execution (REPRODUCING/VERIFYING)", async () => {
      mockStore["case-001"].status = "REPRODUCING";
      const res = await request(app).delete("/api/cases/case-001");
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/active|running/i);
    });
  });
});
