import type { TestRun } from "@bug-to-proof/shared-types";

export const REPRODUCTION_RUN_STATES = [
  "NEEDS_REPORT_DETAILS",
  "DISCOVERING_TARGET",
  "GENERATING_CANDIDATE",
  "CANDIDATE_INVALID",
  "CANDIDATE_EXECUTION_ERROR",
  "BASELINE_PASSED",
  "AWAITING_TEST_REVIEW",
  "CONFIRMING_BASELINE",
  "REPRODUCED",
  "UNSUPPORTED",
  "CANCELLED",
  "BLOCKED",
] as const;

export type ReproductionRunState = (typeof REPRODUCTION_RUN_STATES)[number];

export const REPRODUCTION_RUN_TRANSITIONS: Readonly<Record<ReproductionRunState, readonly ReproductionRunState[]>> = {
  NEEDS_REPORT_DETAILS: ["DISCOVERING_TARGET", "CANCELLED", "BLOCKED"],
  DISCOVERING_TARGET: ["GENERATING_CANDIDATE", "NEEDS_REPORT_DETAILS", "UNSUPPORTED", "CANCELLED", "BLOCKED"],
  GENERATING_CANDIDATE: ["CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "AWAITING_TEST_REVIEW", "UNSUPPORTED", "CANCELLED", "BLOCKED"],
  CANDIDATE_INVALID: ["GENERATING_CANDIDATE", "UNSUPPORTED", "CANCELLED", "BLOCKED"],
  CANDIDATE_EXECUTION_ERROR: ["GENERATING_CANDIDATE", "UNSUPPORTED", "CANCELLED", "BLOCKED"],
  BASELINE_PASSED: ["GENERATING_CANDIDATE", "UNSUPPORTED", "CANCELLED", "BLOCKED"],
  AWAITING_TEST_REVIEW: ["GENERATING_CANDIDATE", "CONFIRMING_BASELINE", "CANCELLED", "BLOCKED"],
  CONFIRMING_BASELINE: ["REPRODUCED", "BASELINE_PASSED", "CANDIDATE_EXECUTION_ERROR", "CANCELLED", "BLOCKED"],
  REPRODUCED: [],
  UNSUPPORTED: [],
  CANCELLED: [],
  BLOCKED: [],
};

export function canTransitionReproductionRun(from: ReproductionRunState, to: ReproductionRunState): boolean {
  return REPRODUCTION_RUN_TRANSITIONS[from].includes(to);
}

export interface ReproductionLimits {
  maxAttempts: number;
  maxSteps: number;
  maxRuntimeMs: number;
  maxDefinitionBytes: number;
  maxDiagnosticBytes: number;
}

export const DEFAULT_REPRODUCTION_LIMITS: Readonly<ReproductionLimits> = Object.freeze({
  maxAttempts: 3,
  maxSteps: 20,
  maxRuntimeMs: 120_000,
  maxDefinitionBytes: 32_000,
  maxDiagnosticBytes: 16_000,
});

export interface ReportSnapshot {
  title: string;
  description: string;
  steps?: readonly string[];
  expected?: string;
  actual?: string;
  startPath?: string;
  context?: string;
}

export interface TargetSnapshotIdentity {
  sourceFingerprint: string;
  targetUrl: string;
  createdAt: string;
}

export interface DiscoverySnapshot {
  artifactPath: string;
  inventoryDigest: string;
  routes: readonly string[];
  capturedAt: string;
}

export interface ReproductionAttempt {
  attempt: number;
  attemptExecutionId: string;
  definition?: unknown;
  definitionHash?: string;
  compilerVersion?: string;
  compiledTestHash?: string;
  provider?: string;
  model?: string;
  responseShape?: string;
  promptVersion?: string;
  classification?: "CANDIDATE_INVALID" | "CANDIDATE_EXECUTION_ERROR" | "BASELINE_PASSED" | "ASSERTION_FAILED";
  failureKind?: import("../runner/playwrightRunner").ExecutionFailureKind;
  diagnostics?: string;
  validationFindings?: readonly string[];
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };
  durationMs?: number;
  artifactPaths: readonly string[];
}

export interface AcceptedReproductionCandidate {
  definitionHash: string;
  compiledTestHash: string;
  reportHash: string;
  targetHash: string;
  discoveryHash: string;
  policyHash: string;
  compilerVersion: string;
  acceptedAt: string;
  acceptedBy: string;
  attempt: number;
  frozenTestPath: string;
  frozenConfigPath: string;
}

export interface ReproductionCandidateReview {
  decision: "APPROVE" | "REJECT";
  definitionHash: string;
  compiledTestHash: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewerNotes?: string;
}

export interface ReproductionEvent {
  sequence: number;
  state: ReproductionRunState;
  message: string;
  createdAt: string;
}

export interface ReproductionRunRecord {
  schemaVersion: "1.0";
  reproductionRunId: string;
  caseId: string;
  state: ReproductionRunState;
  reportSnapshot: ReportSnapshot;
  targetSnapshot?: TargetSnapshotIdentity;
  discovery?: DiscoverySnapshot;
  attempts: readonly ReproductionAttempt[];
  acceptedCandidate?: AcceptedReproductionCandidate;
  review?: ReproductionCandidateReview;
  baselineRun?: TestRun;
  events: readonly ReproductionEvent[];
  limits: ReproductionLimits;
  stopReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StartReproductionRunResponse {
  reproductionRunId: string;
  caseId: string;
  state: ReproductionRunState;
}

export interface ReviewReproductionRequest {
  decision: "APPROVE" | "REJECT";
  definitionHash: string;
  compiledTestHash: string;
}

export interface ReproductionApiError {
  error: string;
  code:
    | "REPRODUCTION_TEST_REQUIRED"
    | "REPORT_DETAILS_REQUIRED"
    | "INVALID_REPRODUCTION_TRANSITION"
    | "REPRODUCTION_RUN_NOT_FOUND"
    | "REPRODUCTION_RUN_CONFLICT";
  details?: string;
}
