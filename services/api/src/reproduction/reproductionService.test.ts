import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReproductionRunStore } from "./reproductionRunStore";
import { ReproductionService } from "./reproductionService";

const dirs: string[] = [];
const discovery = { schemaVersion: "1.0" as const, sourceFingerprint: "source", inventoryDigest: "inventory", routes: ["/", "/cart"],
  controls: [{ role: "button" as const, name: "Add Widget to cart", sourcePath: "src/App.tsx" },
    { role: "link" as const, name: "Cart", sourcePath: "src/App.tsx" }], headings: [],
  fixtures: { products: [{ id: 1, name: "Widget", price: 10 }] }, sourceFiles: ["src/App.tsx"], capturedAt: "2026-10-12T00:00:00.000Z" };
const definition = { schemaVersion: "1.0", title: "Cart report", startPath: "/", preconditions: [],
  steps: [{ type: "click", role: "button", name: "Add Widget to cart" }, { type: "click", role: "link", name: "Cart" }],
  assertion: { type: "urlPathEquals", expected: "/cart" }, rationale: "Maps the report", reportMapping: [{ reportFact: "wrong route", definitionPath: "assertion.expected" }] };
const reports = ["cart total", "cart removal", "checkout navigation"].map(title => ({ title, description: `${title} fails`, steps: ["open app"], expected: "expected", actual: "actual", startPath: "/" }));

afterEach(() => dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
describe("bounded reproduction service", () => {
  it("produces reviewable candidates for three reports without reference-test context", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const generate = vi.fn(async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture", usage: undefined }));
    const execute = vi.fn(async () => ({ outcome: "ASSERTION_FAILED" as const, passed: false, expected: "/cart", actual: "/", durationMs: 10,
      runId: "evidence", testFingerprint: "fp", testIds: ["generated"], artifactPaths: { resultJson: "result.json" }, rawOutput: "BTP_ASSERTION" }));
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate, execute, now: () => "2026-10-12T00:00:00.000Z" });
    for (const [index, report] of reports.entries()) {
      const result = await service.run({ caseId: `case-${index}`, report, targetUrl: "http://localhost:5174" });
      expect(result.state).toBe("AWAITING_TEST_REVIEW"); expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toMatchObject({ classification: "ASSERTION_FAILED", promptVersion: "reproduction-v2" });
      expect(JSON.stringify(result)).not.toContain(root.replace(/\\/g, "/"));
    }
    expect(generate).toHaveBeenCalledTimes(3); expect(JSON.stringify(generate.mock.calls)).not.toMatch(/reference|patch|tests\/playwright/i);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("never treats selector/infrastructure errors as reproduction and bounds retries", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate: async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }),
      execute: async () => ({ outcome: "INFRASTRUCTURE_ERROR", failureKind: "SELECTOR_OR_ACTION_ERROR", passed: false, expected: "", actual: "locator.click timeout", durationMs: 5, runId: "e", testFingerprint: "fp", testIds: [], artifactPaths: {}, rawOutput: "timeout" }),
      now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-error", report: reports[0], targetUrl: "http://localhost:5174", limits: { maxAttempts: 2 } });
    expect(result.state).toBe("CANDIDATE_EXECUTION_ERROR"); expect(result.attempts).toHaveLength(2); expect(result.state).not.toBe("REPRODUCED");
  });

  it("retains unusable successful provider response shapes as candidate diagnostics without infrastructure classification", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const execute = vi.fn();
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery,
      generate: async () => ({ raw: "", provider: "legacy", model: "fixture", responseShape: "choices_array:first_choice_object:message_object:content_missing" }),
      execute, now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-empty-provider", report: reports[0], targetUrl: "http://localhost:5174", limits: { maxAttempts: 2 } });
    expect(result.state).toBe("CANDIDATE_INVALID");
    expect(result.stopReason).toMatch(/attempt limit/i);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ classification: "CANDIDATE_INVALID", responseShape: "choices_array:first_choice_object:message_object:content_missing" });
    expect(result.attempts[0].diagnostics).toMatch(/provider response contained no usable text/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops before generation when cancelled", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root); const controller = new AbortController(); controller.abort();
    const generate = vi.fn();
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate, execute: vi.fn(), now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-cancel", report: reports[0], targetUrl: "http://localhost:5174", abortSignal: controller.signal });
    expect(result.state).toBe("CANCELLED"); expect(generate).not.toHaveBeenCalled();
  });

  it("transitions to CANCELLED when aborted during discovery", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const controller = new AbortController();
    const discover = vi.fn(async () => { controller.abort(); throw new Error("Aborted"); });
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover, generate: vi.fn(), execute: vi.fn(), now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-cancel-disc", report: reports[0], targetUrl: "http://localhost:5174", abortSignal: controller.signal });
    expect(result.state).toBe("CANCELLED");
  });

  it("transitions to CANCELLED when aborted during generation", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const controller = new AbortController();
    const generate = vi.fn(async () => { controller.abort(); throw new Error("Aborted in model"); });
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate, execute: vi.fn(), now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-cancel-gen", report: reports[0], targetUrl: "http://localhost:5174", abortSignal: controller.signal });
    expect(result.state).toBe("CANCELLED");
  });

  it("transitions to CANCELLED and preserves candidate attempt when aborted during execution", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const controller = new AbortController();
    const execute = vi.fn(async () => {
      controller.abort();
      return { outcome: "INFRASTRUCTURE_ERROR" as const, passed: false, expected: "", actual: "Evidence runner was cancelled by abort signal", durationMs: 50, runId: "e-cancel", testFingerprint: "fp", testIds: [], artifactPaths: { resultJson: "result.json" }, rawOutput: "" };
    });
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery,
      generate: async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }),
      execute, now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-cancel-exec", report: reports[0], targetUrl: "http://localhost:5174", abortSignal: controller.signal });
    expect(result.state).toBe("CANCELLED");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].diagnostics).toMatch(/cancelled/i);
  });

  it("never counts target outages as model attempts or retries them", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const generate = vi.fn(async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }));
    const execute = vi.fn(async () => ({
      outcome: "INFRASTRUCTURE_ERROR" as const, failureKind: "TARGET_UNREACHABLE" as const, passed: false, expected: "", actual: "target unavailable",
      durationMs: 10, runId: "e", testFingerprint: "fp", testIds: [], artifactPaths: {}, rawOutput: "fetch failed",
    }));
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate, execute, now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-outage", report: reports[0], targetUrl: "http://localhost:5174", limits: { maxAttempts: 3 } });
    expect(result.state).toBe("BLOCKED");
    expect(result.stopReason).toBe("Target is unreachable");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({ failureKind: "TARGET_UNREACHABLE" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("uses stable unique attempt execution ids and immutable attempt paths", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const calls: any[] = [];
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate: async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }),
      execute: async input => { calls.push(input); return { outcome: "INFRASTRUCTURE_ERROR" as const, failureKind: "SELECTOR_OR_ACTION_ERROR" as const,
        passed: false, expected: "", actual: "bad selector", durationMs: 1, runId: input.runId, testFingerprint: "fp", testIds: [],
        artifactPaths: { resultJson: `artifacts/${input.runId}/result.json` }, rawOutput: "" }; },
      now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ reproductionRunId: "stable-run", caseId: "case-attempts", report: reports[0], targetUrl: "http://localhost:5174", limits: { maxAttempts: 2 } });
    expect(calls.map(call => call.runId)).toEqual(["stable-run-attempt-1", "stable-run-attempt-2"]);
    expect(new Set(result.attempts.map(attempt => attempt.attemptExecutionId)).size).toBe(2);
    expect(calls[0].testFile).not.toBe(calls[1].testFile);
  });

  it.each([
    ["before compilation", ["changed"]],
    ["after execution", ["source", "source", "changed"]],
  ])("blocks when source changes %s and preserves the candidate", async (_label, fingerprints) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root); let index = 0;
    const execute = vi.fn(async () => ({ outcome: "ASSERTION_FAILED" as const, passed: false, expected: "x", actual: "y", durationMs: 1,
      runId: "e", testFingerprint: "fp", testIds: ["x"], artifactPaths: {}, rawOutput: "" }));
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery, generate: async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }), execute,
      fingerprintSource: () => fingerprints[Math.min(index++, fingerprints.length - 1)], now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-input-change", report: reports[0], targetUrl: "http://localhost:5174" });
    expect(result).toMatchObject({ state: "BLOCKED", stopReason: "MiniShop source changed after discovery" });
    expect(result.attempts[0]).toMatchObject({ failureKind: "INPUTS_CHANGED", definition: definition });
    expect(execute).toHaveBeenCalledTimes(fingerprints.length === 1 ? 0 : 1);
  });

  it("never retries a passing baseline and stops at BASELINE_PASSED", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-service-")); dirs.push(root);
    const execute = vi.fn(async () => ({
      outcome: "PASSED" as const, passed: true, expected: "", actual: "All selected tests passed",
      durationMs: 25, runId: "e-pass", testFingerprint: "fp", testIds: ["t1"], artifactPaths: {}, rawOutput: "",
    }));
    const service = new ReproductionService({ store: new ReproductionRunStore(path.join(root, "records")), generatedRoot: path.join(root, "generated"),
      discover: async () => discovery,
      generate: async () => ({ raw: JSON.stringify(definition), provider: "fake", model: "fixture" }),
      execute, now: () => "2026-10-12T00:00:00.000Z" });
    const result = await service.run({ caseId: "case-passed", report: reports[0], targetUrl: "http://localhost:5174", limits: { maxAttempts: 3 } });
    expect(result.state).toBe("BASELINE_PASSED");
    expect(result.stopReason).toMatch(/passed/i);
    expect(result.attempts).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
