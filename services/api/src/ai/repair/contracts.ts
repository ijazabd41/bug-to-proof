import { createHash } from "crypto";
import type { TestRun } from "@bug-to-proof/shared-types";

export type RepairRunState =
  | "INITIALIZING"
  | "REPRODUCING_BASELINE"
  | "INVESTIGATING"
  | "PROPOSING"
  | "AWAITING_REVIEW"
  | "APPLYING"
  | "VERIFYING_REPRODUCTION"
  | "RUNNING_CHECKS"
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "REJECTED"
  | "BLOCKED"
  | "CANCELLED";

export const ACTIVE_REPAIR_STATES: ReadonlySet<RepairRunState> = new Set<RepairRunState>([
  "INITIALIZING",
  "REPRODUCING_BASELINE",
  "INVESTIGATING",
  "PROPOSING",
  "AWAITING_REVIEW",
  "APPLYING",
  "VERIFYING_REPRODUCTION",
  "RUNNING_CHECKS",
]);

export const TERMINAL_REPAIR_STATES: ReadonlySet<RepairRunState> = new Set<RepairRunState>([
  "VERIFIED",
  "VERIFICATION_FAILED",
  "REJECTED",
  "BLOCKED",
  "CANCELLED",
]);

export function isActiveRepairState(state: RepairRunState): boolean {
  return ACTIVE_REPAIR_STATES.has(state);
}

export function isTerminalRepairState(state: RepairRunState): boolean {
  return TERMINAL_REPAIR_STATES.has(state);
}


export interface ProposalEdit {
  relativePath: string;
  oldContent: string;
  newContent: string;
}

export interface ModelProposal {
  schemaVersion: "1.0";
  proposalId: string;
  diagnosis: string;
  assumptions: string[];
  rationale: string;
  edits: ProposalEdit[];
  unifiedDiff: string;
  proposalHash: string;
  proposedAt: string;
}

export interface ProposalReview {
  reviewId?: string;
  proposalId: string;
  proposalHash: string;
  decision: "APPROVED" | "REJECTED";
  reviewedAt?: string;
  reviewerNotes?: string;
}

export type RequiredCheckType =
  | "baseline-reproduction"
  | "post-patch-reproduction"
  | "typecheck"
  | "build"
  | "unit-tests";

export interface RequiredCheckResult {
  checkId: string;
  name: string;
  type: RequiredCheckType;
  command: string;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string;
  artifactPath?: string;
}

export interface RepairEvent {
  timestamp: string;
  stage: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AttemptRecord {
  attemptNumber: number;
  proposal?: ModelProposal;
  review?: ProposalReview;
  postPatchRun?: TestRun;
  requiredChecks?: RequiredCheckResult[];
  state: RepairRunState;
  failureReason?: string;
  diagnostics?: string[];
  stageLatenciesMs?: Record<string, number>;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  startedAt: string;
  completedAt?: string;
}

export interface RunInputs {
  caseSnapshot: Record<string, unknown>;
  reproductionTest: {
    filePath: string;
    content: string;
    fingerprint: string;
  };
}

export interface RepairRunRecord {
  schemaVersion: "1.0";
  runId: string;
  caseId: string;
  mode: "dynamic" | "simulated";
  state: RepairRunState;
  attempt: number;
  maxAttempts: number;
  attempts?: AttemptRecord[];
  inputs?: RunInputs;
  originalSourceFingerprint: string;
  targetSnapshotDir: string;
  testFingerprint: string;
  reproductionTestFile: string;
  targetPort?: number;
  targetUrl?: string;
  baselineRun?: TestRun;
  proposal?: ModelProposal;
  review?: ProposalReview;
  postPatchRun?: TestRun;
  requiredChecks: RequiredCheckResult[];
  events: RepairEvent[];
  error?: string;
  stopReason?: string;
  diagnostics?: string[];
  pricingConfig?: {
    promptPer1k?: number;
    completionPer1k?: number;
    currency?: string;
    datedAsOf?: string;
  };
  costEstimate?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimatedCost?: number;
    currency?: string;
    pricingDate?: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RepairRunConfig {
  mode?: "dynamic" | "simulated";
  provider?: "openai" | "ollama" | "simulated";
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  pricingConfig?: {
    promptPer1k?: number;
    completionPer1k?: number;
    currency?: string;
    datedAsOf?: string;
  };
  simulatedProposal?: {
    diagnosis: string;
    assumptions?: string[];
    rationale: string;
    edits: ProposalEdit[];
  };
  simulatedProposalsByAttempt?: Record<
    number,
    {
      diagnosis: string;
      assumptions?: string[];
      rationale: string;
      edits: ProposalEdit[];
    }
  >;
  seedDefects?: {
    relativePath: string;
    originalSnippet: string;
    defectiveSnippet: string;
  }[];
}

/**
 * Computes a deterministic SHA-256 hash for a proposal based on its canonical edits and diagnosis.
 */
export function computeProposalHash(
  edits: ProposalEdit[],
  diagnosis: string,
  rationale: string
): string {
  const normalizedEdits = edits.map((e) => ({
    relativePath: e.relativePath.replace(/\\/g, "/"),
    oldContent: e.oldContent.replace(/\r\n/g, "\n"),
    newContent: e.newContent.replace(/\r\n/g, "\n"),
  }));
  const payload = JSON.stringify({
    diagnosis: diagnosis.trim(),
    rationale: rationale.trim(),
    edits: normalizedEdits,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function validateProposalShape(data: unknown): data is ModelProposal {
  if (!data || typeof data !== "object") return false;
  const p = data as Record<string, unknown>;
  if (p.schemaVersion !== "1.0") return false;
  if (typeof p.proposalId !== "string" || !p.proposalId.trim()) return false;
  if (typeof p.diagnosis !== "string" || !p.diagnosis.trim()) return false;
  if (!Array.isArray(p.assumptions)) return false;
  if (typeof p.rationale !== "string" || !p.rationale.trim()) return false;
  if (!Array.isArray(p.edits) || p.edits.length === 0) return false;
  if (typeof p.unifiedDiff !== "string") return false;
  if (typeof p.proposalHash !== "string" || p.proposalHash.length !== 64) return false;
  for (const edit of p.edits) {
    if (!edit || typeof edit !== "object") return false;
    const e = edit as Record<string, unknown>;
    if (typeof e.relativePath !== "string" || !e.relativePath.trim()) return false;
    if (typeof e.oldContent !== "string") return false;
    if (typeof e.newContent !== "string") return false;
  }
  return true;
}

export function validateReviewShape(data: unknown): data is ProposalReview {
  if (!data || typeof data !== "object") return false;
  const r = data as Record<string, unknown>;
  if (typeof r.reviewId !== "string" || !r.reviewId.trim()) return false;
  if (typeof r.proposalId !== "string" || !r.proposalId.trim()) return false;
  if (typeof r.proposalHash !== "string" || r.proposalHash.length !== 64) return false;
  if (r.decision !== "APPROVED" && r.decision !== "REJECTED") return false;
  if (typeof r.reviewedAt !== "string") return false;
  return true;
}
