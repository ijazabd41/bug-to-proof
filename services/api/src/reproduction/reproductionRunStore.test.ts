import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ReproductionRunStore } from "./reproductionRunStore";

const dirs: string[] = [];
const record = (id = "run-1") => ({ schemaVersion: "1.0" as const, reproductionRunId: id, caseId: "case-1", state: "DISCOVERING_TARGET" as const,
  reportSnapshot: { title: "x", description: "x", steps: ["x"], expected: "x", actual: "x" }, attempts: [], events: [],
  limits: { maxAttempts: 3, maxSteps: 20, maxRuntimeMs: 120000, maxDefinitionBytes: 32000, maxDiagnosticBytes: 16000 },
  createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z" });

afterEach(() => dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
describe("reproduction run store", () => {
  it("persists atomically and reloads/list runs newest first", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-runs-")); dirs.push(dir);
    const store = new ReproductionRunStore(dir); store.write(record("run-1")); store.write({ ...record("run-2"), updatedAt: "2026-10-13T00:00:00.000Z" });
    expect(new ReproductionRunStore(dir).read("run-1")?.caseId).toBe("case-1");
    expect(store.listForCase("case-1").map(run => run.reproductionRunId)).toEqual(["run-2", "run-1"]);
    expect(fs.readdirSync(dir).some(name => name.includes(".tmp"))).toBe(false);
  });
  it("fails closed on corrupt records and invalid ids", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-runs-")); dirs.push(dir);
    fs.writeFileSync(path.join(dir, "run-bad.json"), "{");
    const store = new ReproductionRunStore(dir);
    expect(() => store.read("run-bad")).toThrow(/corrupt/i);
    expect(() => store.read("../escape")).toThrow(/id/i);
  });
  it("fails closed on syntactically valid structurally invalid records", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-runs-")); dirs.push(dir);
    fs.writeFileSync(path.join(dir, "run-invalid.json"), JSON.stringify({ reproductionRunId: "run-invalid", state: "REPRODUCED" }));
    expect(() => new ReproductionRunStore(dir).read("run-invalid")).toThrow(/corrupt/i);
  });
  it("marks interrupted active runs blocked without altering reviewable runs", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-runs-")); dirs.push(dir); const store = new ReproductionRunStore(dir);
    store.write({ ...record("active"), state: "GENERATING_CANDIDATE" });
    store.write({ ...record("review"), state: "AWAITING_TEST_REVIEW" });
    expect(store.recoverInterrupted(() => "2026-10-14T00:00:00.000Z")).toBe(1);
    expect(store.read("active")).toMatchObject({ state: "BLOCKED", stopReason: "Process was interrupted before completion", completedAt: "2026-10-14T00:00:00.000Z" });
    expect(store.read("review")?.state).toBe("AWAITING_TEST_REVIEW");
  });

  it("skips corrupt run records during startup recovery and preserves corrupt files intact", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-runs-")); dirs.push(dir); const store = new ReproductionRunStore(dir);
    store.write({ ...record("valid-active"), state: "DISCOVERING_TARGET" });
    const corruptPath = path.join(dir, "run-corrupt.json");
    fs.writeFileSync(corruptPath, "{not-valid-json");
    expect(() => store.recoverInterrupted(() => "2026-10-14T00:00:00.000Z")).not.toThrow();
    expect(fs.readFileSync(corruptPath, "utf8")).toBe("{not-valid-json");
    expect(store.read("valid-active")?.state).toBe("BLOCKED");
  });
});
