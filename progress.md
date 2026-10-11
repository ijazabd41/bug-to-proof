# Dynamic AI repair progress and agent handoff

Last updated: 2026-10-09 (Asia/Karachi).
Status: M0-M5 dynamic repair engine and hardening review completed and fully verified; M6 (generated reproduction tests) next.
Plan: [plans/dynamic-ai-repair-plan.md](plans/dynamic-ai-repair-plan.md).
M6 implementation plan: [plans/arbitrary-bug-reproduction-plan.md](plans/arbitrary-bug-reproduction-plan.md).  
M6 progress: [docs/progress/arbitrary-bug-reproduction.md](docs/progress/arbitrary-bug-reproduction.md).

## Goal and agreed direction

The user wants a stronger AI engineering resume project and questioned the benefit of predefined repairs. The selected direction is dynamic model-generated repair for the configured local MiniShop project, preserving evidence integrity. Implement existing-test dynamic repair first; add generated reproduction tests later.

## Read this before continuing

1. Read AGENTS.md and the linked plan, especially invariants and milestone dependencies.
2. Inspect `git status --short` and current files. The workspace already contains modified/untracked files from prior work. Preserve them; do not reset, clean, or assume HEAD matches the intended source.
3. Inspect evidence scripts before executing. Do not seed/reset the main demo merely to create a failing baseline.
4. Update this file with commands, actual results and artifact references; leave unfinished work explicitly unfinished.

## Current architecture and important findings

| File/area | What the next agent needs to know |
| --- | --- |
| `services/api/src/ai/repair/repairGraph.ts` | Full **LangGraph StateGraph** orchestrator with 11 explicit nodes (`prepareWorkspace`, `reproduceBaseline`, `investigateSource`, `proposePatch`, `validateProposal`, `pauseForReview`, `applyApprovedPatch`, `verifyReproduction`, `runRegressionChecks`, `recordFailedAttemptAndRestore`, `finalizeRun`) and conditional edges for blocked baselines, exact review pause/resume, candidate verification, and bounded retries. |
| `services/api/src/ai/repair/fileCheckpointer.ts` | Durable filesystem checkpointer (`FileCheckpointSaver`) persisting execution tuples and state snapshots to `artifacts/runs/<thread_id>/checkpoint.json`, allowing `AWAITING_REVIEW` runs to survive API server restarts. |
| `services/api/src/ai/repair/repairService.ts` | Thin API adapter delegating lifecycle execution to `repairGraph.ts`, starting runs via `graph.invoke(initialState)` and resuming via `graph.invoke(new Command({ resume: review }))`. |
| `services/api/src/ai/repair/workspace.ts` | Manages isolated snapshots under `artifacts/runs/<runId>/workspace/`, copies `tsconfig.base.json` & `packages/`, dynamically allocates available ports, launches Vite with positional root, runs HTTP reachability checks, and terminates process trees on Windows (`taskkill /T /F`). |
| `services/api/src/ai/repair/verification.ts` | Executes regression checks (`tsc --project <minishopDir>/tsconfig.json`, `vite build <minishopDir>`, `vitest run --root <minishopDir>`) on the candidate workspace and verifies candidate source fingerprint invariance. |
| `services/api/src/ai/repair/patchPolicy.ts` | Enforces mutation boundaries (restricts to `apps/minishop/src/`), validates exact match, generates server-side diffs, and performs transactional multi-file application with automatic rollback on failure. |
| `services/api/src/ai/repair/proposal.ts` | Queries LLM or RAG provider with bug report, diagnostics, and source context; parses JSON proposal; computes canonical SHA-256 hash. |
| `services/api/src/ai/agent/` | Legacy **LangGraph** workflow for single-case predefined cart demo. Kept separate from dynamic repair engine. |
| `services/api/src/routes/ai.ts` | Public REST routes for dynamic repair runs. Validates inputs (regex on IDs/hashes, maxAttempts clamped 1–5), strips internal evaluation options (`seedDefects`, `simulatedProposal`). |
| `services/api/src/runner/playwrightRunner.ts` | Executes Playwright specs with custom `targetUrl` and `artifactDir`. Enforces fail-closed BTP assertion verification. |
| `services/api/src/runner/classification.ts` | Requires `ASSERTION_FAILED` with `Expected` vs `Received` diff attachment for valid bug baseline; classifies timeouts or missing reports as `INFRASTRUCTURE_ERROR`. |
| `tests/playwright/cases/` | Case-specific Playwright reproduction specs: `case-001-cart-total.spec.ts`, `case-002-repeated-item-qty.spec.ts`, `case-003-item-removal.spec.ts`, `case-004-cart-clear.spec.ts`, `case-005-cart-total-quantities.spec.ts`. |
| `data/evals/repair-cases.json` | 5 benchmark defect variants (1 dev, 4 held-out) with relative paths, buggy/fixed snippets, diagnoses, and spec links. |
| `scripts/evaluate-repair.ts` | Benchmark evaluation runner supporting `--simulated` (synthetic fixture state machine testing) and `--live` (real browser reproduction, dynamic LLM generation, candidate regression checks, retaining evidence). |

## Milestone tracker

| ID | Deliverable | Status | Dependencies |
| --- | --- | --- | --- |
| M0 | Fresh baseline inventory, contracts, policy and compatibility decisions | DONE | Read plan/current workspace |
| M1 | Isolated target, run-specific runner and durable records | DONE | M0 |
| M2 | Source tools and live model-generated proposals | DONE | M0, M1 |
| M3 | Exact proposal review/apply, independent regression gate, UI | DONE | M1, M2 |
| M4 | Bounded retries, budgets, trace and recovery | DONE | M3 |
| M5 | Held-out repair evaluation and benchmark report | DONE | M3; M4 for loop comparison |
| M6 | Generated accepted reproduction tests | NOT STARTED | Reliable M3-M5 path |
| M7 | Portfolio setup, architecture/demo and accurate claims | DONE | M3; measured claims require M5 |

---

## Session updates

### Session: 2026-10-09 (Asia/Karachi) - Delivery of M0-M3 Dynamic AI Repair MVP

- Delivered core isolated workspace sandboxing, Playwright runner parameterization, bounded source exploration tools, transactional patch policy with rollback, structured JSON model proposal generator, exact review approval binding, and independent regression verification gates.
- `npm run test:unit`: 26 test files passed, 89/89 tests passed (100%).
- `npm run typecheck`: 0 errors across monorepo.
- `npm run build`: Production builds succeeded.

### Session: 2026-10-09 (Asia/Karachi) - Delivery of M4 & M5

- Delivered bounded multi-attempt retries (up to `maxAttempts: 3`), diagnostic feedback loops, pristine workspace restoration between attempts, stage latency tracking, 5-case benchmark evaluation dataset (`data/evals/repair-cases.json`), and benchmark evaluation runner (`scripts/evaluate-repair.ts`).

### Session: 2026-10-09 (Asia/Karachi) - Hardening & Evidence Integrity Review

- **Implemented Fixes (in Priority Order)**:
  1. **Fixed Isolated MiniShop Startup & Reachability (`workspace.ts`)**:
     - Spawned Vite using supported positional root argument (`vite <minishopDir> --config <config> --host 127.0.0.1 --port <port> --strictPort`).
     - Replaced HTTP `HEAD` checks with HTTP `GET` reachability checks (`res.status === 200 || res.status === 304`), resolving Vite dev server 404 on `HEAD`.
     - Implemented dynamic randomized ephemeral port allocation (`getAvailablePort`) avoiding test worker collisions.
     - Automatically copied `tsconfig.base.json` and `packages/` into isolated run workspace, resolving Vite/OXC `[TSCONFIG_ERROR]` on JSX transformation.
     - Verified process tree termination on Windows via `taskkill /pid <pid> /T /F`.
  2. **Candidate Source Regression Checks (`verification.ts`)**:
     - Configured regression checks to execute directly against the candidate source workspace (`tsc --project <minishopDir>/tsconfig.json`, `vite build <minishopDir>`, `vitest run --root <minishopDir>`).
     - Added source manifest fingerprint stability check before and after regression checks to guarantee candidate source invariance.
     - Required 100% passing across every configured check (`every((c) => c.passed)`).
  3. **Evidence Integrity & Exact Approval Binding (`repairService.ts`)**:
     - Recomputed SHA-256 hash (`computeProposalHash(edits, diagnosis, rationale)`) upon review and strictly enforced exact match with the reviewed proposal.
     - Recomputed and validated reproduction test fingerprint against current disk test.
     - Enforced `ASSERTION_FAILED` baseline outcome and validated baseline manifest/report hash before allowing candidate patch application.
  4. **Public API Configuration Hardening (`routes/ai.ts`)**:
     - Validated and sanitized all request parameters (`maxAttempts` clamped to 1–5, `timeoutMs`, regex validation on IDs and hashes).
     - Stripped internal evaluation overrides (`seedDefects`, `simulatedProposal`) from public endpoints to prevent unvetted candidate execution.
  5. **Evaluation Realism & Benchmark Playwright Specs (`evaluate-repair.ts`, `tests/playwright/cases/`)**:
     - Created dedicated Playwright reproduction specs for all 5 benchmark cases:
       - `tests/playwright/cases/case-001-cart-total.spec.ts` (Cart total reflects first item price)
       - `tests/playwright/cases/case-002-repeated-item-qty.spec.ts` (Repeated item quantity increment)
       - `tests/playwright/cases/case-003-item-removal.spec.ts` (Item removal from cart)
       - `tests/playwright/cases/case-004-cart-clear.spec.ts` (Cart clear on checkout)
       - `tests/playwright/cases/case-005-cart-total-quantities.spec.ts` (Cart total quantity multiplication)
     - Extended `MiniShopPage` helper with `removeItem`, `getItemQuantity`, `hasCartItem`, `isCartEmpty`.
     - Explicitly split evaluation runner into:
       - `--simulated`: clearly labeled `[SIMULATED WORKFLOW HARNESS TEST] — NOT REAL MODEL EVALUATION` for synthetic fixture state machine testing.
       - `--live`: real Playwright browser execution against isolated seeded defects, dynamic LLM generation without leaking reference fixes, and candidate regression checks.
     - Retained per-run evidence in `artifacts/runs/<runId>/` and `artifacts/evaluation/` instead of deleting.
     - Enforced honest reporting: in the absence of live LLM API credentials, baseline browser reproduction succeeds (100%) and model status reports `BLOCKED (Model returned an empty response. Verify LLM configuration and credentials.)` rather than mocking AI success.
  6. **Lifecycle Reliability & Concurrency (`repairService.ts`, `runStore.ts`, `caseStore.ts`)**:
     - Added `activeReviewLocks` preventing concurrent review races on the same run.
     - Added cancellation checks between phases, stopping isolated apps and releasing workspace locks.
     - Added run deadline / timeout enforcement (`config.timeoutMs`).
     - Added safe fallback direct write with retries on Windows `EPERM`/`EBUSY` file rename conflicts in `runStore.ts` and `caseStore.ts`.
     - Reported unavailable token usage/cost as unknown.
  7. **Documentation Corrections (`README.md`, `progress.md`)**:
     - Accurately documented TypeScript orchestration for the dynamic AI repair engine vs LangGraph for the legacy cart demo.
     - Delineated live-verified capabilities from simulated harnesses and credential requirements.

- **Verification Commands & Results**:
  - `npm run test:unit`: **26 test files passed, 92/92 tests passed (100%)**.
  - `npm run typecheck`: **0 errors across monorepo** (`@bug-to-proof/api`, `@bug-to-proof/dashboard`, `@bug-to-proof/minishop`, `@bug-to-proof/shared-types`).
  - `npm run build`: Production Vite builds succeeded for all packages (0 errors).
  - `npm run repair:evaluate -- --simulated`: 100% verified across all 5 benchmark cases in 1.14s.
  - `npm run repair:evaluate`: Real browser execution reproduced 100% of baseline bugs (5/5) across all benchmark specs in 51.80s, cleanly reporting unconfigured live model credentials.

### Session: 2026-10-09 (Asia/Karachi) - Delivery of LangGraph Dynamic Repair Orchestrator

- **Implemented Components**:
  1. **Modular LangGraph StateGraph Engine (`services/api/src/ai/repair/repairGraph.ts`)**:
     - Built 11 explicit lifecycle nodes (`prepareWorkspace`, `reproduceBaseline`, `investigateSource`, `proposePatch`, `validateProposal`, `pauseForReview`, `applyApprovedPatch`, `verifyReproduction`, `runRegressionChecks`, `recordFailedAttemptAndRestore`, `finalizeRun`).
     - Defined conditional edges for:
       - Baseline reproduction outcome (stops with `BLOCKED` on passing/infrastructure baseline, proceeds to `investigateSource` on `ASSERTION_FAILED`).
       - Proposal validation (routes to `pauseForReview` on valid patch, loops to `recordFailedAttemptAndRestore` on validation error).
       - Human review pause/resume (`interrupt()` suspends execution in `AWAITING_REVIEW`; `Command({ resume: review })` resumes with exact SHA-256 hash binding; reviewer rejection routes cleanly to `finalizeRun` with status `REJECTED`).
       - Post-patch verification outcome (`PASSED` proceeds to candidate regression checks; failure routes to `recordFailedAttemptAndRestore` if attempts remain, or `finalizeRun` with `VERIFICATION_FAILED`).
       - Candidate regression suite (`tsc`, `vite build`, `vitest run` on candidate source with source invariance verification; all-passed routes to `finalizeRun` with `VERIFIED`).
       - Bounded retry loop (restores pristine snapshot, gathers failure diagnostics, enforces attempt limit and time deadline).
  2. **Durable File Checkpointer (`services/api/src/ai/repair/fileCheckpointer.ts`)**:
     - Implemented `FileCheckpointSaver` extending `MemorySaver` to persist graph checkpoint buffers to `artifacts/runs/<thread_id>/checkpoint.json` with binary base64 serialization.
     - Preserves interrupted `AWAITING_REVIEW` states across process/API server restarts.
  3. **Thin API Service Adapter (`services/api/src/ai/repair/repairService.ts`)**:
     - Converted `repairService.ts` to a thin adapter delegating execution to `buildRepairGraph`.
     - Starts runs via `graph.invoke(initialState)` and resumes via `graph.invoke(new Command({ resume: review }))`.
  4. **Orchestrator Test Suites (`repairGraph.test.ts`, `repairService.test.ts`)**:
     - Unit & integration test suites covering baseline gates, exact review hash binding, reviewer rejection, verification failure retry loops, and checkpoint resume.

- **Verification Commands & Results**:
  - `npm run test:unit`: **27 test files passed, 97/97 tests passed (100%)**.
  - `npm run typecheck`: **0 errors across monorepo** (`@bug-to-proof/api`, `@bug-to-proof/dashboard`, `@bug-to-proof/minishop`, `@bug-to-proof/shared-types`).
  - `npm run build`: Production Vite builds succeeded for all packages (0 errors).
  - `npm run repair:evaluate -- --simulated`: **100% verified across all 5 benchmark cases (5/5) in 1.76s** using the LangGraph StateGraph engine.

### Session: 2026-10-09 (Asia/Karachi) - Comprehensive Hardening & Review Verification

- **Hardened Areas Implemented & Verified**:
  1. **Complete Verification Gates (`validateVerificationGates` in `verification.ts`)**:
     - Enforces baseline assertion failure (`ASSERTION_FAILED` with `Expected` vs `Received` diff).
     - Enforces valid baseline manifest and non-empty report hash.
     - Enforces matching test fingerprints across baseline, current disk, and post-patch runs.
     - Enforces matching executed test identities against target case ID.
     - Enforces passing unchanged reproduction test.
     - Enforces 100% passing required regression checks (`tsc`, `vite build`, `vitest run`) on candidate workspace.
     - Enforces candidate source invariance before and after check execution.
     - Negative unit tests in `verification.test.ts` (6/6 pass) covering tampered report hashes, modified specs, mismatched test IDs, non-assertion baselines, and incomplete check suites.
  2. **Source Snapshot & Approval Revalidation (`repairGraph.ts`, `repairService.ts`)**:
     - Recomputes canonical proposal SHA-256 hash before applying.
     - Validates current candidate workspace snapshot against original baseline snapshot.
     - Rejects changes made during human review pause, including out-of-proposal modifications.
     - Approval strictly resumes the existing proposal without regeneration.
  3. **Real Cancellation & Process Tree Termination (`repairService.ts`, `workspace.ts`)**:
     - `cancelRepairRun` triggers `AbortController` cancellation across model requests and active child processes.
     - Windows process tree termination via `taskkill /pid <PID> /T /F` releases ports and locks within 500ms.
     - Graph routes to terminal `CANCELLED` state; subsequent review or application requests are rejected.
     - Concurrency tests verify `CANCELLED` state cannot be overwritten by later execution.
  4. **Infrastructure Error Separation**:
     - Post-patch infrastructure failures (timeouts, network errors, process crashes) stop with explicit `BLOCKED` outcome.
     - Retries are strictly reserved for eligible assertion failures (`ASSERTION_FAILED`) or regression check failures within attempt and time limits.
  5. **Durable LangGraph Checkpoint Persistence (`fileCheckpointer.ts`)**:
     - `FileCheckpointSaver` extends `MemorySaver` to persist graph checkpoint buffers to `artifacts/runs/<thread_id>/checkpoint.json` with binary base64 serialization.
     - Pending writes are keyed and stored under `[threadId, ns, cpId]` tuples, surviving full process restarts.
     - Cross-process reload verified by two-process simulation test (`fileCheckpointer.test.ts`) and audit test `GRAPH-04`.
  6. **Separation of Pristine Snapshots from Evidence (`verification.ts`)**:
     - `runRegressionChecks` writes check logs to dedicated run/attempt evidence directories (`artifacts/runs/<runId>/attempt-<n>/checks/`), keeping `pristine/` immutable.
     - Complete pristine restoration verified by fingerprint comparison before retry iterations.
  7. **Upgraded Comprehensive Audit Suite (`scripts/audit-system.ts`)**:
     - Real Playwright browser smoke, navigation, case detail inspection, 404 presentation, and screenshot capture (`DASH-01`).
     - Cross-process durable checkpoint reload and resume (`GRAPH-04`).
     - Detection of a deliberately defective candidate by the trusted regression suite (`GATE-02`).
     - State/tool policy checks verifying prompt injection strings cannot mutate state or alter verification records (`RAG-04`).
### Session: 2026-10-09 (Asia/Karachi) - Verification Defect Fixes & Evidence Integrity Release

- **Correctness Fixes Implemented**:
  1. **Reporter Test Identity Binding (`verification.ts`)**:
     - Bound test identity validation to reproduction spec file basename (`case-001-cart-total.spec.ts`).
     - Supported Playwright JSON reporter-format `${file}:${title}:${project}` test IDs.
     - Rejected empty or mismatched executed test identities.
  2. **Saved Disk Evidence Validation (`verification.ts`)**:
     - Loaded `manifest.json` and `result.json` from run-specific artifact directories.
     - Recomputed SHA-256 digests from `result.json` content and reclassified outcomes via `classifyReport()`.
     - Verified baseline and post-patch report hashes, test fingerprints, and candidate regression logs.
  3. **Runtime Resource Registry & Cancellation (`runtimeRegistry.ts`, `workspace.ts`, `repairService.ts`)**:
     - Decoupled active process handles (`appProcess`, runners, checks) from checkpointed graph state.
     - Managed `AbortController`, child processes, and `run.lock` in singleton `RuntimeResourceRegistry`.
     - Ensured cancellation signals abort model requests, terminate process trees via `taskkill`, release locks, and prevent `CANCELLED` from being overwritten.
  4. **True Multi-Process Restart & Double-Apply Protection (`fileCheckpointer.ts`, `patchPolicy.ts`, `repairGraph.ts`)**:
     - Added `areEditsAlreadyApplied()` to `patchPolicy.ts` and `applyApprovedPatchNode` for idempotent resume.
     - Built dedicated `scripts/helpers/twoproc-runner.ts` and verified cross-process restart via independent OS subprocesses (`GRAPH-04` in `audit-system.ts`).
  5. **Evaluator and Live LLM Execution (`evaluate-repair.ts`, `client.ts`, `scripts/record-live-model-repairs.ts`)**:
     - Fixed evaluation runner mock test identities to reporter format (`npm run repair:evaluate -- --simulated` passes 5/5 cases in 2.65s).
     - Made `callLLM` read environment variables dynamically.
     - Evaluated live model repair on 5 benchmark cases via Groq (`openai/gpt-oss-20b`), verifying 4/5 cases without reference solution leaks.

- **Verification Commands & Results**:
  - `npm run test:unit`: **29 test files passed, 107/107 tests passed (100%)**.
  - `npm run typecheck`: **0 errors across monorepo** (`@bug-to-proof/api`, `@bug-to-proof/dashboard`, `@bug-to-proof/minishop`, `@bug-to-proof/shared-types`).
  - `npm run build`: Production Vite builds succeeded for all packages (0 errors).
  - `npm run repair:evaluate -- --simulated`: **100% verified across all 5 benchmark cases (5/5)** in 2.65s.
  - `npx tsx scripts/audit-system.ts`: **25/25 audit checks passed (0 failed, 0 blocked)**.
  - `npx tsx scripts/verify-real-browser-workflow.ts`: Real browser failure-to-pass workflow **VERIFIED** through LangGraph.
  - `npx tsx scripts/record-live-model-repairs.ts`: **4/5 benchmark cases genuinely repaired and verified by live LLM**.

### Session: 2026-10-09 (Asia/Karachi) - Lifecycle Hardening, Cancellation Propagation, Checkpoint Decoupling & Evidence Integrity

- **Implemented Correctness & Integrity Enhancements**:
  1. **Complete Cancellation Propagation (`playwrightRunner.ts`, `verification.ts`, `client.ts`, `providers.ts`, `proposal.ts`, `repairGraph.ts`)**:
     - Registered runner and regression child processes in `runtimeRegistry` keyed by `runId`.
     - Propagated run `AbortSignal` into model generation calls (`callLLM`, `generateAnswer`, `generateProposal`), Playwright runner executions, and candidate regression checks.
     - Enforced process tree termination on signal cancellation or timeout, released workspace locks, and ensured `CANCELLED` status remains terminal without downstream patch application or verification.
     - Added unit tests in `lifecycle.test.ts` for model generation cancellation and runner process termination.
  2. **Live Handles Completely Removed from Checkpoints (`workspace.ts`, `repairGraph.ts`, `runtimeRegistry.ts`)**:
     - Removed `appProcess` and all non-serializable handles from `RunWorkspace` and LangGraph state.
     - Stored child process references strictly in singleton `runtimeRegistry`.
     - In `repairGraph.ts`, implemented automatic reachability verification and safe on-demand re-establishment of Vite server upon resuming from disk checkpoints.
     - Added comprehensive integration test in `lifecycle.test.ts` verifying real Vite process restart recovery across checkpoints without handles in state.
  3. **Binary Invariant & Idempotent Resume (`patchPolicy.ts`, `repairGraph.ts`)**:
     - Added `computeExpectedPatchedFingerprint(minishopDir, edits)` computing the expected post-patch source manifest from the pristine snapshot + approved edits.
     - Enforced binary acceptance invariant in `applyApprovedPatchNode`: workspace must match either (a) pristine original snapshot (apply edits transactionally), or (b) expected patched snapshot (already applied).
     - Rejected partial, mutated, or ambiguous workspace states with explicit error.
     - Added tests in `lifecycle.test.ts` validating interrupted patch resume without double-application and rejection of mutated workspace state.
  4. **Centralized Evidence Binding & Baseline Gate (`verification.ts`, `repairGraph.ts`)**:
     - Enforced `validateBaselineGates` before candidate patch application in `applyApprovedPatchNode` as well as during final verification.
     - Bound reporter test identities (`${specFile}:${title}:${project}`), recomputed SHA-256 report digests, actual exit codes, and test fingerprints to run-specific artifact directories in dynamic mode.
     - Added negative test suite in `verification.test.ts` testing swapped reports, stale manifests with wrong run ID, missing regression logs, altered identities, and candidate mismatches.
  5. **Non-Destructive Evaluation Storage & Full Denominator Reporting (`evaluate-repair.ts`)**:
     - Preserved existing user cases via backup/restore mechanism during benchmark runs instead of destructive deletion.
     - Formatted evaluation output and JSON report with complete metrics: `datasetHash`, run IDs, artifact links, attempt counts, failure reasons, denominators for every rate (`x / n`), and token usage/cost fields.
     - Kept simulated fixtures explicitly separated from live model execution.

- **Verification Commands & Results**:
  - `npx vitest run`: **30 test files passed, 112/112 tests passed (100%)**.
  - `npm run typecheck`: **0 errors across monorepo** (`@bug-to-proof/api`, `@bug-to-proof/dashboard`, `@bug-to-proof/minishop`, `@bug-to-proof/shared-types`).
  - `npm run build`: Production Vite builds succeeded for dashboard and minishop.
  - `npx tsx scripts/audit-system.ts`: **25/25 audit checks passed (0 failed, 0 blocked)**.
  - `npm run repair:evaluate -- --simulated`: **100% (5/5) simulated benchmark verified in 7.61s** with explicit denominators and non-destructive case isolation.
  - Saved live-model runs preserved in `artifacts/system-testing/review-live-2026-10-09/saved-run-review.json` (4/5 cases verified).

- **Next Milestone**: M6 (Model-generated reproduction tests from bug report prose).

### Session: 2026-10-10 (Asia/Karachi) - Monorepo Audit, Windows NTFS Concurrency Fixes, Hygiene & Security Remediation

- **Monorepo Audit Findings & Resolved Issues**:
  1. **Atomic File Persistence Retry Hardening (`services/api/src/ai/repair/runStore.ts`)**:
     - Added bounded 5-attempt retry loop with `sleepSync` (15ms backoff) for `EPERM`, `EBUSY`, and `EACCES` errors during `fs.renameSync(tmpPath, filePath)`.
     - Preserved existing invariants tested in `runStorePersistence.test.ts` (byte-for-byte immutability on failure, no unsafe copy overwrite, structured `RunStorageError` throw).
  2. **Transient Lock Backoff in Case Deletion (`services/api/src/storage/caseStore.ts`)**:
     - Added `sleepSync` (15ms backoff) in `deleteCase` retry loop on Windows transient lock codes, preventing orphaned test files.
  3. **PID Collision / Exited Process Check (`services/api/src/ai/repair/workspace.ts`)**:
     - Added `child.exitCode !== null` guard in `terminateProcessTree` to prevent `taskkill` from executing against terminated or reassigned PIDs on Windows.
  4. **Test Isolation Fix (`services/api/src/ai/repair/repairService.test.ts`)**:
     - Reset `createdRunId = null` at the start of `beforeEach` to prevent cross-test resource leakage into `afterEach`.
  5. **Repository Hygiene & Artifact Purge**:
     - Removed all orphaned test fixtures (`case-guard-*.json`, `case-dyn-*.json`, `case-1790519790562.json`) from `data/cases/`.
     - Removed stale `.d.ts.map` build artifacts from `apps/dashboard/src/`.
     - Suppressed `VITE_CONFIG_NATIVE_IGNORE_WARNING` in `vitest.config.ts`.
  6. **Security Remediation (`npm audit fix`)**:
     - Resolved critical command injection vulnerability in `shell-quote` (`GHSA-pqg4-j6r4-53mv`) and DoS vulnerability in `source-map-js` (`GHSA-68fv-2mgg-jv7q`). Reduced vulnerabilities from 9 to 7 without breaking changes.

- **Verification Commands & Results**:
  - `npm run typecheck`: **0 errors across monorepo** (`@bug-to-proof/api`, `@bug-to-proof/dashboard`, `@bug-to-proof/minishop`).
  - `npm run build`: Production Vite builds succeeded for dashboard (10.17s) and minishop (5.35s).
  - `npx vitest run services/api/src/ai/repair/repairService.test.ts`: **7/7 tests passed (100%)**.
  - `npx vitest run services/api/src/ai/repair/lifecycle.test.ts`: **4/4 tests passed (100%)** without worker crashes.
  - `npx vitest run services/api/src/ai/repair/runStorePersistence.test.ts`: **8/8 tests passed (100%)**.
  - `npx vitest run services/api/src/storage/`: **9/9 tests passed (100%)**.
  - `npx tsx scripts/evaluate-repair.ts --simulated`: **100% (8/8) benchmark cases verified**.
  - `npm run rag:evaluate`: **100% off-topic abstention, 90% Hit@4 hybrid retrieval**.





