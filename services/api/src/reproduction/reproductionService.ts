import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { RunResult } from "../runner/playwrightRunner";
import { DEFAULT_REPRODUCTION_LIMITS, type ReportSnapshot, type ReproductionLimits, type ReproductionRunRecord, type ReproductionRunState } from "./contracts";
import { validateCandidateAgainstDiscovery } from "./candidatePolicy";
import { persistCompiledReproduction, validateReproductionDefinition } from "./definitionCompiler";
import { persistTargetDiscovery, type TargetDiscoverySnapshot } from "./targetDiscovery";
import type { ReproductionRunStore } from "./reproductionRunStore";

export const REPRODUCTION_PROMPT_VERSION = "reproduction-v1";
export interface GenerationResult { raw: string; provider: string; model: string; responseShape?: string; usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number } }
export interface GenerationContext { report: ReportSnapshot; discovery: TargetDiscoverySnapshot; attempt: number; previousDiagnostics: readonly string[]; promptVersion: typeof REPRODUCTION_PROMPT_VERSION }
export interface ReproductionServiceDependencies {
  store: ReproductionRunStore; generatedRoot: string;
  discover(input: { caseId: string; targetUrl: string; abortSignal?: AbortSignal }): Promise<TargetDiscoverySnapshot>;
  generate(context: GenerationContext, abortSignal?: AbortSignal): Promise<GenerationResult>;
  execute(input: { caseId: string; testFile: string; targetUrl: string; runId: string; timeoutMs: number; abortSignal?: AbortSignal }): Promise<RunResult>;
  fingerprintSource?: () => string;
  now?: () => string; id?: () => string;
}
export interface StartReproductionInput { reproductionRunId?: string; caseId: string; report: ReportSnapshot; targetUrl: string; limits?: Partial<ReproductionLimits>; abortSignal?: AbortSignal }

export class ReproductionService {
  constructor(private readonly deps: ReproductionServiceDependencies) {}
  async run(input: StartReproductionInput): Promise<ReproductionRunRecord> {
    const now = this.deps.now ?? (() => new Date().toISOString()); const runId = input.reproductionRunId ?? (this.deps.id ?? randomUUID)();
    const limits = { ...DEFAULT_REPRODUCTION_LIMITS, ...input.limits }; const createdAt = now();
    const run: ReproductionRunRecord = { schemaVersion: "1.0", reproductionRunId: runId, caseId: input.caseId, state: "DISCOVERING_TARGET",
      reportSnapshot: structuredClone(input.report), attempts: [], events: [], limits, createdAt, updatedAt: createdAt };
    const transition = (state: ReproductionRunState, message: string) => { run.state = state; run.updatedAt = now(); run.events = [...run.events, { sequence: run.events.length + 1, state, message, createdAt: run.updatedAt }]; this.deps.store.write(run); };
    if (!input.report.steps?.length || !input.report.expected?.trim() || !input.report.actual?.trim()) {
      transition("NEEDS_REPORT_DETAILS", "Structured steps, expected behavior, and actual behavior are required"); return run;
    }
    transition("DISCOVERING_TARGET", "Started bounded target discovery");
    if (input.abortSignal?.aborted) { transition("CANCELLED", "Cancelled before target discovery"); run.completedAt = now(); this.deps.store.write(run); return run; }
    let discovery: TargetDiscoverySnapshot;
    try { discovery = await this.deps.discover({ caseId: input.caseId, targetUrl: input.targetUrl, abortSignal: input.abortSignal }); }
    catch (error) {
      if (input.abortSignal?.aborted) {
        transition("CANCELLED", "Cancelled during target discovery"); run.stopReason = "Cancelled by user"; run.completedAt = now(); this.deps.store.write(run); return run;
      }
      transition("BLOCKED", `Target discovery failed: ${bounded(error, limits.maxDiagnosticBytes)}`); run.stopReason = "Target discovery failed"; run.completedAt = now(); this.deps.store.write(run); return run;
    }
    run.targetSnapshot = { sourceFingerprint: discovery.sourceFingerprint, targetUrl: input.targetUrl, createdAt: discovery.capturedAt };
    const discoveryArtifact = persistTargetDiscovery(discovery, path.join(this.deps.generatedRoot, runId, "discovery"));
    run.discovery = { artifactPath: artifactReference(discoveryArtifact.artifactPath, this.deps.generatedRoot), inventoryDigest: discovery.inventoryDigest, routes: discovery.routes, capturedAt: discovery.capturedAt };
    const diagnostics: string[] = [];
    for (let attemptNumber = 1; attemptNumber <= limits.maxAttempts; attemptNumber++) {
      if (input.abortSignal?.aborted) { transition("CANCELLED", "Cancelled before candidate generation"); run.stopReason = "Cancelled by user"; run.completedAt = now(); this.deps.store.write(run); return run; }
      transition("GENERATING_CANDIDATE", `Generating candidate attempt ${attemptNumber}`); const started = Date.now();
      const attemptExecutionId = `${runId}-attempt-${attemptNumber}`;
      let generated: GenerationResult;
      try { generated = await this.deps.generate({ report: run.reportSnapshot, discovery, attempt: attemptNumber, previousDiagnostics: diagnostics, promptVersion: REPRODUCTION_PROMPT_VERSION }, input.abortSignal); }
      catch (error) {
        if (input.abortSignal?.aborted) {
          transition("CANCELLED", "Cancelled during candidate generation"); run.stopReason = "Cancelled by user"; run.completedAt = now(); this.deps.store.write(run); return run;
        }
        diagnostics.push(bounded(error, limits.maxDiagnosticBytes)); run.stopReason = "Generation provider failed"; transition("BLOCKED", diagnostics.at(-1)!); run.completedAt = now(); this.deps.store.write(run); return run;
      }
      const rawArtifact = persistRawOutput(this.deps.generatedRoot, runId, attemptNumber, generated.raw, limits.maxDefinitionBytes);
      const parsed = validateReproductionDefinition(generated.raw); const policy = parsed.ok ? validateCandidateAgainstDiscovery(parsed.value, discovery) : { ok: false, findings: parsed.errors };
      if (!parsed.ok || !policy.ok) {
        const finding = (!generated.raw.trim() && generated.responseShape
          ? `Provider response contained no usable text (${generated.responseShape})`
          : policy.findings.join("; ")).slice(0, limits.maxDiagnosticBytes); diagnostics.push(finding);
        run.attempts = [...run.attempts, { attempt: attemptNumber, attemptExecutionId, provider: generated.provider, model: generated.model, promptVersion: REPRODUCTION_PROMPT_VERSION,
          responseShape: generated.responseShape, classification: "CANDIDATE_INVALID", diagnostics: finding, validationFindings: policy.findings, durationMs: Date.now() - started, usage: generated.usage, artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot)] }];
        transition("CANDIDATE_INVALID", `Candidate ${attemptNumber} failed validation`); continue;
      }
      if (this.inputsChanged(discovery)) return this.blockChangedInputs(run, attemptNumber, attemptExecutionId, generated, rawArtifact, now, parsed.value);
      let compiled; let execution: RunResult;
      try {
        compiled = persistCompiledReproduction(parsed.value, attemptExecutionId, this.deps.generatedRoot);
        if (this.inputsChanged(discovery)) return this.blockChangedInputs(run, attemptNumber, attemptExecutionId, generated, rawArtifact, now, parsed.value, compiled);
        execution = await this.deps.execute({ caseId: input.caseId, testFile: compiled.filePath, targetUrl: input.targetUrl, runId: attemptExecutionId, timeoutMs: limits.maxRuntimeMs, abortSignal: input.abortSignal });
      } catch (error) {
        const diagnostic = bounded(error, limits.maxDiagnosticBytes);
        run.attempts = [...run.attempts, { attempt: attemptNumber, attemptExecutionId, provider: generated.provider, model: generated.model,
          promptVersion: REPRODUCTION_PROMPT_VERSION, classification: "CANDIDATE_EXECUTION_ERROR", failureKind: "INVALID_REPORT",
          diagnostics: diagnostic, durationMs: Date.now() - started, usage: generated.usage, artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot)] }];
        transition("BLOCKED", `Candidate execution failed unexpectedly: ${diagnostic}`); run.stopReason = "Candidate execution infrastructure failed";
        run.completedAt = now(); this.deps.store.write(run); return run;
      }
      if (this.inputsChanged(discovery)) return this.blockChangedInputs(run, attemptNumber, attemptExecutionId, generated, rawArtifact, now, parsed.value, compiled, execution);
      if (input.abortSignal?.aborted) {
        run.attempts = [...run.attempts, { attempt: attemptNumber, attemptExecutionId, definition: parsed.value, definitionHash: compiled.definitionHash, compilerVersion: compiled.compilerVersion,
          compiledTestHash: compiled.compiledHash, provider: generated.provider, model: generated.model, promptVersion: REPRODUCTION_PROMPT_VERSION,
          classification: "CANDIDATE_EXECUTION_ERROR", failureKind: "CANCELLED", diagnostics: "Candidate execution was cancelled", durationMs: execution.durationMs, usage: generated.usage,
          artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot), artifactReference(compiled.filePath, this.deps.generatedRoot), ...Object.values(execution.artifactPaths).filter((value): value is string => !!value)] }];
        transition("CANCELLED", "Candidate execution was cancelled"); run.stopReason = "Cancelled by user"; run.completedAt = now(); this.deps.store.write(run); return run;
      }
      if (execution.failureKind === "TARGET_UNREACHABLE" || execution.failureKind === "BROWSER_UNAVAILABLE" || execution.failureKind === "INPUTS_CHANGED") {
        run.attempts = [...run.attempts, { attempt: attemptNumber, attemptExecutionId, definition: parsed.value, definitionHash: compiled.definitionHash,
          compilerVersion: compiled.compilerVersion, compiledTestHash: compiled.compiledHash, provider: generated.provider, model: generated.model,
          promptVersion: REPRODUCTION_PROMPT_VERSION, classification: "CANDIDATE_EXECUTION_ERROR", failureKind: execution.failureKind,
          diagnostics: bounded(execution.actual, limits.maxDiagnosticBytes), durationMs: execution.durationMs, usage: generated.usage,
          artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot), artifactReference(compiled.filePath, this.deps.generatedRoot), ...Object.values(execution.artifactPaths).filter((value): value is string => !!value)] }];
        transition("BLOCKED", `Target outage: ${bounded(execution.actual, limits.maxDiagnosticBytes)}`);
        run.stopReason = execution.failureKind === "TARGET_UNREACHABLE" ? "Target is unreachable" : execution.failureKind === "BROWSER_UNAVAILABLE" ? "Browser is unavailable" : "Execution inputs changed";
        run.completedAt = now(); this.deps.store.write(run); return run;
      }
      const classification = execution.outcome === "ASSERTION_FAILED" ? "ASSERTION_FAILED" : execution.outcome === "PASSED" ? "BASELINE_PASSED" : "CANDIDATE_EXECUTION_ERROR";
      run.attempts = [...run.attempts, { attempt: attemptNumber, attemptExecutionId, definition: parsed.value, definitionHash: compiled.definitionHash, compilerVersion: compiled.compilerVersion,
        compiledTestHash: compiled.compiledHash, provider: generated.provider, model: generated.model, promptVersion: REPRODUCTION_PROMPT_VERSION, classification,
        failureKind: execution.failureKind,
        diagnostics: bounded(execution.actual, limits.maxDiagnosticBytes), durationMs: execution.durationMs, usage: generated.usage,
        artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot), artifactReference(compiled.filePath, this.deps.generatedRoot), ...Object.values(execution.artifactPaths).filter((value): value is string => !!value)] }];
      if (classification === "ASSERTION_FAILED") { transition("AWAITING_TEST_REVIEW", "Candidate produced a structured assertion failure and requires review"); return run; }
      if (classification === "BASELINE_PASSED") {
        transition("BASELINE_PASSED", "Candidate baseline passed without reproducing the bug");
        run.stopReason = "Candidate baseline passed without reproducing the bug"; run.completedAt = now(); this.deps.store.write(run); return run;
      }
      if (execution.failureKind !== "SELECTOR_OR_ACTION_ERROR") {
        transition("BLOCKED", "Candidate execution failed with non-retryable infrastructure error"); run.stopReason = execution.failureKind ?? "Execution infrastructure failed";
        run.completedAt = now(); this.deps.store.write(run); return run;
      }
      transition(classification, "Candidate execution failed without a report assertion");
      diagnostics.push(bounded(execution.actual, limits.maxDiagnosticBytes));
    }
    run.completedAt = now(); run.stopReason = `Candidate attempt limit (${limits.maxAttempts}) reached`; this.deps.store.write(run); return run;
  }
  private inputsChanged(discovery: TargetDiscoverySnapshot): boolean { return !!this.deps.fingerprintSource && this.deps.fingerprintSource() !== discovery.sourceFingerprint; }
  private blockChangedInputs(run: ReproductionRunRecord, attempt: number, attemptExecutionId: string, generated: GenerationResult, rawArtifact: string,
    now: () => string, definition?: unknown, compiled?: { definitionHash: string; compilerVersion: string; compiledHash: string; filePath: string }, execution?: RunResult): ReproductionRunRecord {
    run.attempts = [...run.attempts, { attempt, attemptExecutionId, definition, definitionHash: compiled?.definitionHash, compilerVersion: compiled?.compilerVersion,
      compiledTestHash: compiled?.compiledHash, provider: generated.provider, model: generated.model, promptVersion: REPRODUCTION_PROMPT_VERSION,
      classification: "CANDIDATE_EXECUTION_ERROR", failureKind: "INPUTS_CHANGED", diagnostics: "MiniShop source changed after discovery",
      durationMs: execution?.durationMs, usage: generated.usage, artifactPaths: [artifactReference(rawArtifact, this.deps.generatedRoot), ...(compiled ? [artifactReference(compiled.filePath, this.deps.generatedRoot)] : []),
        ...Object.values(execution?.artifactPaths ?? {}).filter((value): value is string => !!value)] }];
    run.state = "BLOCKED"; run.stopReason = "MiniShop source changed after discovery"; run.updatedAt = now(); run.completedAt = run.updatedAt;
    run.events = [...run.events, { sequence: run.events.length + 1, state: "BLOCKED", message: run.stopReason, createdAt: run.updatedAt }]; this.deps.store.write(run); return run;
  }
}
function artifactReference(file: string, root: string): string { const relative = path.relative(path.resolve(root), path.resolve(file)); if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Artifact path escaped generated root"); return relative.replace(/\\/g, "/"); }
function bounded(value: unknown, max: number): string { return (value instanceof Error ? value.message : String(value)).slice(0, max); }
function persistRawOutput(root: string, runId: string, attempt: number, raw: string, maxBytes: number): string {
  const directory = path.resolve(root, runId, `attempt-${attempt}`); const containment = path.resolve(root);
  if (!directory.startsWith(`${containment}${path.sep}`)) throw new Error("Raw output path escaped generated root");
  fs.mkdirSync(directory, { recursive: true }); const filePath = path.join(directory, "model-output.txt");
  const bytes = Buffer.from(raw, "utf8");
  const boundedRaw = bytes.length <= maxBytes ? raw : `${bytes.subarray(0, maxBytes).toString("utf8")}\n[TRUNCATED: provider output exceeded ${maxBytes} bytes]`;
  fs.writeFileSync(filePath, boundedRaw, "utf8"); return filePath;
}
