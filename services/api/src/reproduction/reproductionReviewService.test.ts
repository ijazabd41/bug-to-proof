import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { persistCompiledReproduction } from "./definitionCompiler";
import { ReproductionRunStore } from "./reproductionRunStore";
import { ReproductionReviewService } from "./reproductionReviewService";
import type { ReproductionRunRecord } from "./contracts";

const definition = {
  schemaVersion: "1.0" as const,
  title: "wrong total",
  startPath: "/",
  preconditions: [{ type: "clearLocalStorage" as const }],
  steps: [{ type: "clickTarget" as const, testId: "add-to-cart-1" }],
  assertion: { type: "targetCurrencyEquals" as const, testId: "cart-total", expected: 15, currency: "USD" },
  rationale: "shipping must be included",
  reportMapping: [{ reportFact: "total should be 15", definitionPath: "assertion.expected" }],
};

const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-review-")); roots.push(root);
  const generatedRoot = path.join(root, "generated");
  const acceptedRoot = path.join(root, "accepted");
  const store = new ReproductionRunStore(path.join(root, "records"));
  const attemptExecutionId = "review-run-attempt-1";
  const compiled = persistCompiledReproduction(definition, attemptExecutionId, generatedRoot);
  const reportSnapshot = { title: "Total", description: "Wrong", steps: ["add Keyboard"], expected: "$15", actual: "$10", startPath: "/", context: "" };
  const run: ReproductionRunRecord = {
    schemaVersion: "1.0", reproductionRunId: "review-run", caseId: "case-review", state: "AWAITING_TEST_REVIEW",
    reportSnapshot, targetSnapshot: { sourceFingerprint: "source", targetUrl: "http://localhost:5174", createdAt: "2026-10-14T00:00:00.000Z" },
    discovery: { artifactPath: "review-run/discovery/discovery.json", inventoryDigest: "inventory", routes: ["/"], capturedAt: "2026-10-14T00:00:00.000Z" },
    attempts: [{ attempt: 1, attemptExecutionId, definition, definitionHash: compiled.definitionHash, compilerVersion: compiled.compilerVersion,
      compiledTestHash: compiled.compiledHash, classification: "ASSERTION_FAILED", artifactPaths: [] }],
    events: [], limits: { maxAttempts: 3, maxSteps: 20, maxRuntimeMs: 120000, maxDefinitionBytes: 32000, maxDiagnosticBytes: 16000 },
    createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
  };
  store.write(run);
  const execute = vi.fn(async (input: { testFile: string }) => ({ outcome: "ASSERTION_FAILED" as const, passed: false, expected: "15", actual: input.testFile ? "10" : "unreachable", durationMs: 5,
    runId: "confirmed", testFingerprint: "frozen-fingerprint", testIds: ["generated"], reportHash: "evidence-hash", artifactPaths: { resultJson: "result.json" }, rawOutput: "" }));
  const service = new ReproductionReviewService({ store, generatedRoot, acceptedRoot, execute, fingerprintSource: () => "source", now: () => "2026-10-14T01:00:00.000Z" });
  return { root, generatedRoot, acceptedRoot, store, compiled, reportSnapshot, run, execute, service };
}

describe("reproduction candidate review and frozen baseline", () => {
  it("binds approval to both hashes, freezes immutable bytes, and confirms the same test on unchanged source", async () => {
    const f = fixture();
    const result = await f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot });
    expect(result.state).toBe("REPRODUCED");
    expect(result.acceptedCandidate).toMatchObject({ definitionHash: f.compiled.definitionHash, compiledTestHash: f.compiled.compiledHash,
      acceptedBy: "human" });
    expect(result.acceptedCandidate?.frozenTestPath.endsWith(path.join("accepted", "review-run", "reproduction.spec.ts"))).toBe(true);
    expect(result.baselineRun).toMatchObject({ outcome: "ASSERTION_FAILED", testFingerprint: "frozen-fingerprint" });
    expect(f.execute).toHaveBeenCalledWith(expect.objectContaining({ testFile: result.acceptedCandidate?.frozenTestPath }));
    expect(fs.readFileSync(result.acceptedCandidate!.frozenTestPath, "utf8")).toBe(f.compiled.source);
  });

  it.each(["definitionHash", "compiledTestHash"] as const)("rejects stale or swapped %s approval", async field => {
    const f = fixture();
    await expect(f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: field === "definitionHash" ? "0".repeat(64) : f.compiled.definitionHash,
      compiledTestHash: field === "compiledTestHash" ? "0".repeat(64) : f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot })).rejects.toThrow(/hash/i);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("rejects changed report/source/test bytes and never labels them reproduced", async () => {
    const f = fixture();
    await expect(f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: { ...f.reportSnapshot, expected: "$20" } })).rejects.toThrow(/report/i);
    fs.appendFileSync(path.join(f.generatedRoot, "review-run-attempt-1", "generated-test", "reproduction.spec.ts"), "\n// tamper");
    await expect(f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot })).rejects.toThrow(/bytes|hash/i);
  });

  it("records rejection without accepting or confirming a baseline", async () => {
    const f = fixture();
    const result = await f.service.review({ runId: "review-run", decision: "REJECT", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot, reviewerNotes: "assertion is not relevant" });
    expect(result.state).toBe("BLOCKED");
    expect(result.acceptedCandidate).toBeUndefined();
    expect(result.review).toMatchObject({ decision: "REJECT", reviewerNotes: "assertion is not relevant" });
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("requires a fresh review after a revision and refuses approval replay", async () => {
    const f = fixture();
    await f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot });
    await expect(f.service.review({ runId: "review-run", decision: "APPROVE", definitionHash: f.compiled.definitionHash,
      compiledTestHash: f.compiled.compiledHash, acceptedBy: "human", currentReport: f.reportSnapshot })).rejects.toThrow(/state|already/i);
  });
});
