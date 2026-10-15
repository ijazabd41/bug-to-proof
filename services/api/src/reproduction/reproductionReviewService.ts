import fs from "fs";
import path from "path";
import type { TestRun } from "@bug-to-proof/shared-types";
import { digest, type RunResult, trustedGeneratedPlaywrightConfig } from "../runner/playwrightRunner";
import type { ReportSnapshot, ReproductionRunRecord } from "./contracts";
import type { ReproductionRunStore } from "./reproductionRunStore";

export interface ReproductionReviewDependencies {
  store: ReproductionRunStore;
  generatedRoot: string;
  acceptedRoot: string;
  execute(input: { caseId: string; testFile: string; targetUrl: string; runId: string; timeoutMs: number; generatedTestRoot: string }): Promise<RunResult>;
  fingerprintSource(): string;
  now?: () => string;
}

export interface ReviewReproductionCandidateInput {
  runId: string;
  decision: "APPROVE" | "REJECT";
  definitionHash: string;
  compiledTestHash: string;
  acceptedBy: string;
  reviewerNotes?: string;
  currentReport: ReportSnapshot;
}

export class ReproductionReviewError extends Error {
  constructor(message: string, public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_REVIEW") { super(message); this.name = "ReproductionReviewError"; }
}

export class ReproductionReviewService {
  constructor(private readonly deps: ReproductionReviewDependencies) {}

  async review(input: ReviewReproductionCandidateInput): Promise<ReproductionRunRecord> {
    const run = this.deps.store.read(input.runId);
    if (!run) throw new ReproductionReviewError("Reproduction run not found", "NOT_FOUND");
    if (run.state !== "AWAITING_TEST_REVIEW") throw new ReproductionReviewError(`Cannot review run in state ${run.state}`, "CONFLICT");
    const attempt = [...run.attempts].reverse().find(item => item.classification === "ASSERTION_FAILED");
    if (!attempt?.definition || !attempt.definitionHash || !attempt.compiledTestHash || !attempt.compilerVersion) {
      throw new ReproductionReviewError("Run has no reviewable assertion-failure candidate", "CONFLICT");
    }
    if (input.definitionHash !== attempt.definitionHash || input.compiledTestHash !== attempt.compiledTestHash) {
      throw new ReproductionReviewError("Review hashes do not match the current candidate", "CONFLICT");
    }
    const timestamp = (this.deps.now ?? (() => new Date().toISOString()))();
    run.review = { decision: input.decision, definitionHash: input.definitionHash, compiledTestHash: input.compiledTestHash,
      reviewedAt: timestamp, reviewedBy: bounded(input.acceptedBy, 200), reviewerNotes: input.reviewerNotes ? bounded(input.reviewerNotes, 2000) : undefined };
    if (input.decision === "REJECT") {
      run.state = "BLOCKED"; run.stopReason = "Candidate rejected by reviewer"; run.updatedAt = timestamp; run.completedAt = timestamp;
      run.events = [...run.events, { sequence: run.events.length + 1, state: "BLOCKED", message: "Candidate rejected; a revised candidate requires a new run and review", createdAt: timestamp }];
      this.deps.store.write(run); return run;
    }
    if (hash(input.currentReport) !== hash(run.reportSnapshot)) throw new ReproductionReviewError("Report changed after candidate generation; a fresh run and review are required", "CONFLICT");
    if (!run.targetSnapshot || this.deps.fingerprintSource() !== run.targetSnapshot.sourceFingerprint) {
      throw new ReproductionReviewError("Target source changed after candidate generation; a fresh run and review are required", "CONFLICT");
    }
    const sourcePath = path.resolve(this.deps.generatedRoot, attempt.attemptExecutionId, "generated-test", "reproduction.spec.ts");
    ensureContainedFile(sourcePath, this.deps.generatedRoot);
    const source = fs.readFileSync(sourcePath);
    if (digest(source) !== attempt.compiledTestHash) throw new ReproductionReviewError("Compiled test bytes do not match the reviewed hash", "CONFLICT");
    const acceptedDirectory = path.resolve(this.deps.acceptedRoot, run.reproductionRunId);
    ensureContainedPath(acceptedDirectory, this.deps.acceptedRoot);
    fs.mkdirSync(acceptedDirectory, { recursive: true });
    if (fs.lstatSync(acceptedDirectory).isSymbolicLink()) throw new ReproductionReviewError("Symlinked accepted-test directories are unsupported", "INVALID_REVIEW");
    const frozenTestPath = path.join(acceptedDirectory, "reproduction.spec.ts");
    writeImmutable(frozenTestPath, source);
    const frozenConfigPath = trustedGeneratedPlaywrightConfig(acceptedDirectory);
    run.state = "CONFIRMING_BASELINE"; run.updatedAt = timestamp;
    run.events = [...run.events, { sequence: run.events.length + 1, state: "CONFIRMING_BASELINE", message: "Approval hashes verified; confirming frozen candidate on unchanged source", createdAt: timestamp }];
    this.deps.store.write(run);
    const execution = await this.deps.execute({ caseId: run.caseId, testFile: frozenTestPath, targetUrl: run.targetSnapshot.targetUrl,
      runId: `${run.reproductionRunId}-accepted-baseline`, timeoutMs: run.limits.maxRuntimeMs, generatedTestRoot: this.deps.acceptedRoot });
    const completedAt = (this.deps.now ?? (() => new Date().toISOString()))();
    if (this.deps.fingerprintSource() !== run.targetSnapshot.sourceFingerprint || digest(fs.readFileSync(frozenTestPath)) !== attempt.compiledTestHash) {
      return this.finishFailure(run, "BLOCKED", "Accepted inputs changed during baseline confirmation", completedAt);
    }
    run.baselineRun = toTestRun(execution, completedAt);
    if (execution.outcome !== "ASSERTION_FAILED") {
      return this.finishFailure(run, execution.outcome === "PASSED" ? "BASELINE_PASSED" : "CANDIDATE_EXECUTION_ERROR",
        execution.outcome === "PASSED" ? "Frozen candidate baseline passed without reproducing the report" : "Frozen baseline confirmation failed", completedAt);
    }
    run.acceptedCandidate = { definitionHash: attempt.definitionHash, compiledTestHash: attempt.compiledTestHash,
      reportHash: hash(run.reportSnapshot), targetHash: hash(run.targetSnapshot), discoveryHash: hash(run.discovery),
      policyHash: hash({ inventoryDigest: run.discovery?.inventoryDigest, compilerVersion: attempt.compilerVersion, schemaVersion: run.schemaVersion }),
      compilerVersion: attempt.compilerVersion, acceptedAt: timestamp, acceptedBy: bounded(input.acceptedBy, 200), attempt: attempt.attempt,
      frozenTestPath, frozenConfigPath };
    run.state = "REPRODUCED"; run.stopReason = undefined; run.updatedAt = completedAt; run.completedAt = completedAt;
    run.events = [...run.events, { sequence: run.events.length + 1, state: "REPRODUCED", message: "Frozen reviewed candidate reproduced the report on unchanged source", createdAt: completedAt }];
    this.deps.store.write(run); return run;
  }

  private finishFailure(run: ReproductionRunRecord, state: "BLOCKED" | "BASELINE_PASSED" | "CANDIDATE_EXECUTION_ERROR", reason: string, at: string): ReproductionRunRecord {
    run.state = state; run.stopReason = reason; run.updatedAt = at; run.completedAt = at;
    run.events = [...run.events, { sequence: run.events.length + 1, state, message: reason, createdAt: at }]; this.deps.store.write(run); return run;
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const hash = (value: unknown) => digest(JSON.stringify(canonical(value)));
const bounded = (value: string, max: number) => value.trim().slice(0, max) || "human";
function ensureContainedPath(value: string, root: string): void { const resolvedRoot = path.resolve(root); if (!value.startsWith(`${resolvedRoot}${path.sep}`)) throw new ReproductionReviewError("Accepted path escaped its root", "INVALID_REVIEW"); }
function ensureContainedFile(value: string, root: string): void { ensureContainedPath(value, root); if (!fs.existsSync(value) || !fs.statSync(value).isFile()) throw new ReproductionReviewError("Reviewed compiled test is missing", "CONFLICT"); }
function writeImmutable(file: string, content: Buffer): void {
  if (fs.existsSync(file)) { if (!fs.readFileSync(file).equals(content)) throw new ReproductionReviewError("Frozen accepted test already exists with different bytes", "CONFLICT"); return; }
  const temporary = `${file}.${process.pid}.tmp`; fs.writeFileSync(temporary, content, { flag: "wx" }); fs.renameSync(temporary, file);
}
function toTestRun(result: RunResult, runAt: string): TestRun { return { outcome: result.outcome, testFingerprint: result.testFingerprint, testIds: result.testIds,
  runId: result.runId, reportHash: result.reportHash, runAt, passed: result.passed, expected: result.expected, actual: result.actual, durationMs: result.durationMs, evidenceIds: [] }; }
