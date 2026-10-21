import { createHash } from "node:crypto";

export type EvaluationCase = { id: string; split: "dev" | "held-out"; category: string; report: Record<string, unknown>;
  label?: "answerable-bug" | "control"; defects?: Array<{ relativePath: string; fixedContent: string; buggyContent: string }>;
  referenceTest?: string; variantFingerprint?: string; referenceTestHash?: string };
export type EvaluationDataset = { schemaVersion: string; frozenAt: string; status: string; policy: Record<string, unknown>; cases: EvaluationCase[]; datasetHash: string };
export type EvaluationReview = { evaluationId: string; reproductionRunId: string; definitionHash: string; decision: "MATCH" | "MISMATCH"; reviewedBy: string; reviewedAt: string; notes: string };

export const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;

export function datasetHash(data: EvaluationDataset): string {
  return createHash("sha256").update(canonical({ schemaVersion: data.schemaVersion, frozenAt: data.frozenAt, policy: data.policy, cases: data.cases })).digest("hex");
}

export function validateDataset(data: EvaluationDataset): void {
  if (datasetHash(data) !== data.datasetHash) throw new Error("Frozen dataset hash mismatch");
  if (data.status !== "FROZEN_FOR_FUTURE_EVALUATION" || data.policy.promptTuningAfterFreezeAllowed !== false) throw new Error("Dataset is not frozen");
  const ids = data.cases.map(item => item.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))) throw new Error("Dataset case IDs must be unique and safe");
  if (!data.cases.length || data.cases.some(item => !["dev", "held-out"].includes(item.split) || !item.report ||
    !String(item.report.title ?? "").trim() || !String(item.report.description ?? "").trim() ||
    !Array.isArray(item.report.steps) || !item.report.steps.length || !String(item.report.expected ?? "").trim() || !String(item.report.actual ?? "").trim())) {
    throw new Error("Every evaluation case requires a split and complete structured report");
  }
}

export function assertHeldoutFresh(datasetHashValue: string, split: "dev" | "held-out", ledger: unknown): void {
  if (split !== "held-out") return;
  const entries = (ledger as { consumed?: Array<{ datasetHash?: string; split?: string }> } | null)?.consumed;
  if (!Array.isArray(entries)) throw new Error("Consumed held-out ledger is invalid");
  if (entries.some(item => item.datasetHash === datasetHashValue && item.split === "held-out")) {
    throw new Error("This held-out dataset has already been consumed; freeze a new cohort before another live evaluation");
  }
}

export interface ScoredCase {
  evaluationId: string; split: "dev" | "held-out"; category: string; label: "answerable-bug" | "control" | "unknown"; caseId?: string; reproductionRunId?: string; state: string;
  stopReason?: string; attempts: number; providerRequests: number; classifications: string[]; responseShapes: string[];
  validCandidate: boolean; executableCandidate: boolean; assertionFailure: boolean; reviewedReportMatch: boolean;
  acceptedFrozenBaseline: boolean; infrastructureError: boolean; unsupported: boolean; durationMs: number | null;
  usage: unknown[]; reviewStatus: "MATCH" | "MISMATCH" | "PENDING"; error?: string;
}

export function scoreCase(item: EvaluationCase, run: any, review?: EvaluationReview, error?: string): ScoredCase {
  const attempts: any[] = Array.isArray(run?.attempts) ? run.attempts : [];
  const failedAssertion = attempts.some(attempt => attempt.classification === "ASSERTION_FAILED");
  const candidate = attempts.find(attempt => attempt.classification === "ASSERTION_FAILED");
  const validReview = !!review && review.evaluationId === item.id && review.reproductionRunId === run?.reproductionRunId &&
    review.definitionHash === candidate?.definitionHash && !!review.reviewedBy?.trim() && !!review.reviewedAt && !!review.notes?.trim();
  const reviewStatus = validReview ? review!.decision : "PENDING";
  const started = Date.parse(run?.createdAt ?? "");
  const ended = Date.parse(run?.completedAt ?? run?.updatedAt ?? "");
  const infrastructureError = !!error || attempts.some(attempt => attempt.classification === "PROVIDER_ERROR" ||
    ["TARGET_UNREACHABLE", "BROWSER_UNAVAILABLE", "EXECUTION_TIMEOUT", "INPUTS_CHANGED"].includes(attempt.failureKind) ||
    (attempt.failureKind === "INVALID_REPORT" && !/Error: expect\(locator\)/.test(attempt.diagnostics ?? "")));
  return {
    evaluationId: item.id, split: item.split, category: item.category, label: item.label ?? "unknown", caseId: run?.caseId, reproductionRunId: run?.reproductionRunId,
    state: run?.state ?? "EVALUATION_ERROR", stopReason: run?.stopReason, attempts: attempts.length,
    providerRequests: attempts.reduce((sum, attempt) => sum + (Number.isInteger(attempt.requestAttempts) ? attempt.requestAttempts : attempt.provider ? 1 : 0), 0),
    classifications: attempts.map(attempt => attempt.classification ?? "UNKNOWN"), responseShapes: attempts.map(attempt => attempt.responseShape ?? "unknown"),
    validCandidate: attempts.some(attempt => !!attempt.definitionHash), executableCandidate: attempts.some(attempt => ["ASSERTION_FAILED", "BASELINE_PASSED"].includes(attempt.classification)),
    assertionFailure: failedAssertion, reviewedReportMatch: failedAssertion && reviewStatus === "MATCH",
    acceptedFrozenBaseline: run?.state === "REPRODUCED" && !!run?.acceptedCandidate && run?.baselineRun?.outcome === "ASSERTION_FAILED",
    infrastructureError, unsupported: run?.state === "UNSUPPORTED", durationMs: Number.isFinite(started) && Number.isFinite(ended) ? ended - started : null,
    usage: attempts.map(attempt => attempt.usage ?? null), reviewStatus, ...(error ? { error } : {}),
  };
}

export function aggregateCases(results: readonly ScoredCase[]) {
  const count = (predicate: (item: ScoredCase) => boolean) => results.filter(predicate).length;
  const latencies = results.map(item => item.durationMs).filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  return { denominator: results.length, metrics: {
    answerableBugCases: count(item => item.label === "answerable-bug"), controlCases: count(item => item.label === "control"),
    validCandidates: count(item => item.validCandidate), executableCandidates: count(item => item.executableCandidate),
    answerableValidCandidates: count(item => item.label === "answerable-bug" && item.validCandidate),
    answerableExecutableCandidates: count(item => item.label === "answerable-bug" && item.executableCandidate),
    assertionFailures: count(item => item.assertionFailure), reviewedReportMatches: count(item => item.reviewedReportMatch),
    reviewedBugMatches: count(item => item.label === "answerable-bug" && item.reviewedReportMatch),
    controlFalsePositives: count(item => item.label === "control" && (item.reviewedReportMatch || item.acceptedFrozenBaseline)),
    acceptedFrozenBaselines: count(item => item.acceptedFrozenBaseline), infrastructureErrors: count(item => item.infrastructureError),
    unsupported: count(item => item.unsupported), pendingReviews: count(item => item.reviewStatus === "PENDING" && item.assertionFailure),
    providerRequestsTotal: results.reduce((sum, item) => sum + item.providerRequests, 0),
    latencyP95Ms: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null,
    measuredLatencyCases: latencies.length,
    unknownUsageCases: count(item => item.usage.every(value => value === null)),
  } };
}
