export type ReproductionRunState =
  | "NEEDS_REPORT_DETAILS"
  | "DISCOVERING_TARGET"
  | "GENERATING_CANDIDATE"
  | "CANDIDATE_INVALID"
  | "CANDIDATE_EXECUTION_ERROR"
  | "BASELINE_PASSED"
  | "AWAITING_TEST_REVIEW"
  | "CONFIRMING_BASELINE"
  | "REPRODUCED"
  | "UNSUPPORTED"
  | "CANCELLED"
  | "BLOCKED";

export interface ReproductionAttemptSummary {
  attempt: number;
  definitionHash?: string;
  compiledTestHash?: string;
  definition?: unknown;
  classification?: string;
  diagnostics?: string;
  durationMs?: number;
  provider?: string;
  model?: string;
  responseShape?: string;
  requestAttempts?: number;
  httpStatus?: number;
}

export interface AcceptedReproductionCandidateSummary {
  definitionHash: string;
  compiledTestHash: string;
  acceptedAt: string;
  acceptedBy: string;
  frozenTestPath: string;
}

export interface ReproductionEventSummary {
  sequence: number;
  state: ReproductionRunState;
  message: string;
  createdAt: string;
}

export interface ReproductionRunRecordSummary {
  schemaVersion: "1.0";
  reproductionRunId: string;
  caseId: string;
  state: ReproductionRunState;
  reportSnapshot?: { title: string; description: string; steps?: readonly string[]; expected?: string; actual?: string; startPath?: string; context?: string };
  attempts: ReproductionAttemptSummary[];
  acceptedCandidate?: AcceptedReproductionCandidateSummary;
  review?: { decision: "APPROVE" | "REJECT"; reviewedAt: string; reviewedBy: string; reviewerNotes?: string };
  events: ReproductionEventSummary[];
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
