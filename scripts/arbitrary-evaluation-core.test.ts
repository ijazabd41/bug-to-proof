import { describe, expect, it } from "vitest";
import { aggregateCases, assertHeldoutFresh, scoreCase, type EvaluationCase } from "./arbitrary-evaluation-core";

const item: EvaluationCase = { id: "heldout-cart", split: "held-out", category: "calculation", report: { title: "Cart" } };
const run = { caseId: "case-1", reproductionRunId: "run-1", state: "AWAITING_TEST_REVIEW", createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:01Z",
  attempts: [{ attempt: 1, definitionHash: "definition", classification: "ASSERTION_FAILED", requestAttempts: 2, provider: "openai" }] };

describe("prospective evaluation scoring", () => {
  it("keeps an unreviewed assertion separate from report-matched reproduction", () => {
    const scored = scoreCase(item, run);
    expect(scored).toMatchObject({ assertionFailure: true, reviewedReportMatch: false, reviewStatus: "PENDING", providerRequests: 2 });
    expect(aggregateCases([scored]).metrics).toMatchObject({ assertionFailures: 1, reviewedReportMatches: 0, pendingReviews: 1 });
  });

  it("requires a matching run and definition in an independent review", () => {
    const review = { evaluationId: item.id, reproductionRunId: "run-1", definitionHash: "definition", decision: "MATCH" as const,
      reviewedBy: "reviewer", reviewedAt: "2026-10-20T00:00:02Z", notes: "Assertion matches the report" };
    expect(scoreCase(item, run, review).reviewedReportMatch).toBe(true);
    expect(scoreCase(item, run, { ...review, definitionHash: "different" }).reviewedReportMatch).toBe(false);
  });

  it("retains provider failure and evaluator timeout in the full denominator", () => {
    const provider = scoreCase(item, { ...run, state: "BLOCKED", attempts: [{ classification: "PROVIDER_ERROR", responseShape: "http_error:429", requestAttempts: 3 }] });
    const timeout = scoreCase({ ...item, id: "heldout-timeout" }, undefined, undefined, "Poll deadline exceeded");
    expect(aggregateCases([provider, timeout])).toMatchObject({ denominator: 2, metrics: { infrastructureErrors: 2, reviewedReportMatches: 0 } });
  });

  it("does not count a candidate's invalid browser action as an infrastructure failure", () => {
    const invalid = scoreCase(item, { ...run, state: "BLOCKED", attempts: [{ classification: "CANDIDATE_EXECUTION_ERROR", failureKind: "INVALID_REPORT", definitionHash: "definition", diagnostics: "Error: expect(locator).toBeVisible() failed" }] });
    expect(invalid).toMatchObject({ infrastructureError: false, validCandidate: true, executableCandidate: false });
    const missingRunnerReport = scoreCase(item, { ...run, state: "BLOCKED", attempts: [{ classification: "CANDIDATE_EXECUTION_ERROR", failureKind: "INVALID_REPORT", diagnostics: "Invalid or missing Playwright JSON report" }] });
    expect(missingRunnerReport.infrastructureError).toBe(true);
  });

  it("separates answerable bug matches from control false positives", () => {
    const review = { evaluationId: "heldout-cart", reproductionRunId: "run-1", definitionHash: "definition", decision: "MATCH" as const,
      reviewedBy: "reviewer", reviewedAt: "2026-10-20T00:00:02Z", notes: "Reviewed trace" };
    const bug = scoreCase({ ...item, label: "answerable-bug" }, run, review);
    const control = scoreCase({ ...item, label: "control" }, run, review);
    expect(aggregateCases([bug, control]).metrics).toMatchObject({ answerableBugCases: 1, controlCases: 1, reviewedBugMatches: 1, controlFalsePositives: 1 });
  });

  it("prevents a second held-out execution of a consumed dataset while allowing development checks", () => {
    const ledger = { consumed: [{ datasetHash: "frozen-hash", split: "held-out" }] };
    expect(() => assertHeldoutFresh("frozen-hash", "held-out", ledger)).toThrow(/already been consumed/);
    expect(() => assertHeldoutFresh("frozen-hash", "dev", ledger)).not.toThrow();
    expect(() => assertHeldoutFresh("new-hash", "held-out", ledger)).not.toThrow();
  });

  it("summarizes provider requests, unknown usage, and observed latency without inventing a cost", () => {
    const first = scoreCase(item, run);
    const second = scoreCase({ ...item, id: "second" }, { ...run, createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:03Z",
      attempts: [{ classification: "BASELINE_PASSED", provider: "openai", requestAttempts: 3 }] });
    expect(aggregateCases([first, second]).metrics).toMatchObject({ providerRequestsTotal: 5, latencyP95Ms: 3000, unknownUsageCases: 2 });
  });
});
