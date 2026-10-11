import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs";
import app from "../index";
import { casePath, deleteCase, writeCase } from "../storage/caseStore";
import seed from "./legacy-case.fixture.json";
import type { BugCase } from "@bug-to-proof/shared-types";

describe("Corrupt Case Record API Boundary Behavior", () => {
  const normalCaseId = "case-normal-test";
  const corruptCaseId = "case-corrupted-test";

  beforeEach(() => {
    const normalCase: BugCase = {
      ...(structuredClone(seed) as BugCase),
      id: normalCaseId,
      title: "Normal Valid Case",
    };
    writeCase(normalCase);

    // Create an explicitly corrupt JSON file on disk
    const corruptPath = casePath(corruptCaseId);
    fs.writeFileSync(corruptPath, "{ this is not valid JSON and truncated data...", "utf-8");
  });

  afterEach(() => {
    deleteCase(normalCaseId);
    deleteCase(corruptCaseId);
  });

  it("returns 404 for genuinely non-existent case", async () => {
    const res = await request(app).get("/api/cases/case-does-not-exist-999");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Case not found/i);
  });

  it("returns explicit 500/error response when case file on disk is corrupted", async () => {
    const res = await request(app).get(`/api/cases/${corruptCaseId}`);
    // Must distinguish corruption from missing (cannot return generic 404 Case not found)
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/corrupt|invalid/i);
  });

  it("returns explicit 500/error response when case list contains a corrupt record instead of silently omitting it", async () => {
    const res = await request(app).get("/api/cases");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/corrupt|invalid/i);
  });

  it("returns 200 for normal case", async () => {
    const res = await request(app).get(`/api/cases/${normalCaseId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Normal Valid Case");
  });
});
