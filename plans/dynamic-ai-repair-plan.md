# Dynamic AI repair implementation plan

Created: 2026-10-09 (Asia/Karachi).
Status: M0-M5 implemented and verified using LangGraph StateGraph orchestrator with durable checkpointing; M6 planned.
Companion tracker: [progress.md](../progress.md).

## Objective and scope

Upgrade Bug-to-Proof from a predefined cart repair into a bounded AI repair system for the configured local MiniShop TypeScript/React project. Given a report and initially an existing reproduction test, the system should investigate source, generate a new patch, request review of that exact patch, execute it in an isolated workspace, and record independent verification. Later, generate reproduction tests from reports.

Dynamic means no case ID selects a stored solution and no buggy string selects a predefined replacement. It does not mean support for every repository or guaranteed correctness. Keep the original deterministic repair only as an explicitly labelled legacy demo or evaluation baseline.

Do not deploy, merge, publish, modify unrelated projects, or launch parallel agents automatically. Follow AGENTS.md. This document plans work; it does not authorize executing future patches against the user's primary checkout.

## Target workflow and LangGraph StateGraph architecture

The dynamic repair engine is implemented using **LangGraph StateGraph** (`services/api/src/ai/repair/repairGraph.ts`) with durable filesystem checkpointing (`FileCheckpointSaver`):

`prepareWorkspace -> reproduceBaseline -> (ASSERTION_FAILED) -> investigateSource -> proposePatch -> validateProposal -> pauseForReview -> (interrupt / resume) -> applyApprovedPatch -> verifyReproduction -> runRegressionChecks -> finalizeRun`

Bounded retry loop:
- `validateProposal` failure -> `recordFailedAttemptAndRestore` -> `investigateSource` (attempt <= maxAttempts)
- `verifyReproduction` failure -> `recordFailedAttemptAndRestore` -> `investigateSource`
- `runRegressionChecks` failure -> `recordFailedAttemptAndRestore` -> `investigateSource`
- Reviewer rejection -> `finalizeRun` with `REJECTED` status
- Passing baseline / infrastructure error -> `finalizeRun` with `BLOCKED` status

Implemented modules:

- `services/api/src/ai/repair/contracts.ts`: versioned run, proposal, policy, review, check and evaluation types.
- `services/api/src/ai/repair/fileCheckpointer.ts`: durable filesystem checkpointer (`FileCheckpointSaver`) persisting graph state across restarts.
- `services/api/src/ai/repair/repairGraph.ts`: 11-node LangGraph StateGraph orchestrator with conditional edges and review interruption.
- `services/api/src/ai/repair/repairService.ts`: thin adapter for starting, inspecting, reviewing, and cancelling graph runs.
- `services/api/src/ai/repair/workspace.ts`: run snapshot, target root, app lifecycle, ephemeral port allocation, locks, cleanup.
- `services/api/src/ai/repair/tools.ts`: list/search/read with bounded results and canonical path checks.
- `services/api/src/ai/repair/proposal.ts`: model adapter, prompt version, structured output parser.
- `services/api/src/ai/repair/patchPolicy.ts`: edit restrictions, old-content preconditions, proposal hash, transactional application.
- `services/api/src/ai/repair/runStore.ts`: atomic persistent records, append-only events, interruption recovery.
- `services/api/src/ai/repair/verification.ts`: baseline/reproduction/regression evidence aggregation.

Prefer a versioned repair record alongside BugCase over immediately expanding all legacy statuses. Inspect the frozen-contract comment in `packages/shared-types/src/index.ts`; add compatible contracts separately where practical. If existing contracts must change, document migration and obtain any genuinely required team sign-off before that dependent change. Do independent implementation first.

Minimum run record: schemaVersion, runId, caseId, state, attempt, originalSourceFingerprint, target snapshot identity, policy hash, model/provider/prompt version, baseline/after/check artifact references, proposal ID/hash, review record, stage timings, usage, stop reason and timestamps.

Minimum proposal: schemaVersion, diagnosis with source references, edits[{relativePath, oldContent, newContent}], rationale, assumptions. Derive a unified diff server-side. Require exact old content with unambiguous matching, bounded edit size/file count, canonical target path and original file hash. Reject malformed responses rather than interpreting prose as edits. Full-file replacement is optional only with original file hash and explicit size limits.

Suggested API, confirm naming during M0:

- POST `/api/ai/cases/:id/repair-runs`: create run with explicit mode and existing test; no automatic primary-checkout writes.
- GET `/api/ai/repair-runs/:runId`: state, events, proposal and artifact references.
- POST `/api/ai/repair-runs/:runId/review`: approve/reject exact proposal ID/hash and snapshot identity.
- POST `/api/ai/repair-runs/:runId/cancel`: stop and retain evidence.

Run creation returns promptly; use polling initially. Never hold one HTTP request for an entire repair. Repeated approval must be idempotent. Keep legacy debug endpoint explicitly labelled or migrate its client; do not silently change its apply semantics.

## Ordered milestones

### M0: Baseline inventory and contracts

Tasks:
- Read AGENTS.md, current source, existing route/graph/evidence tests and git status. Preserve dirty and untracked user work; do not reset or clean.
- Inventory Node/npm/browser availability, current target state and configured providers without printing secrets.
- Record unit, typecheck and build baseline through the evidence recording workflow. Use the evidence runner for browser reproduction. Inspect `scripts/record-demo.ts` before invocation; do not seed/reset the primary target merely to make a demo fail.
- Document baseline failures as pre-existing or environmental, with real artifact references.
- Define run/proposal/check schemas, API compatibility, execution policy and approved runtime commands.

Acceptance: baseline inventory is recorded; contracts distinguish model claims, execution outcomes and required-check outcomes. No application behaviour changes in M0.

### M1: Isolated local execution and durable run records

Tasks:
- Make runner/integrity operations accept explicit run target root and artifact root; preserve existing defaults for legacy demo calls.
- Snapshot current intended source, including relevant uncommitted changes, without copying `.git`, `.env`, secrets, artifacts or unrelated files. Write a source manifest; never derive a snapshot only from HEAD when local changes exist.
- Keep installed tooling controlled and dependency files immutable. Do not share writable dependency trees with generated code. Select practical OS isolation and state its limitations.
- Launch a run-specific MiniShop process/port, pass base URL to Playwright, and record which target/port was tested. Remove hardcoded port assumptions in both runner reachability and Playwright config.
- Use durable run locks; allow sequential runs initially. Stop child processes reliably on timeout/cancel. Recover interrupted runs conservatively without inventing success.
- Atomic run metadata writes and uniquely addressed artifacts. Cleanup only checked paths inside the run root; retain proof artifacts.

Checks: snapshot containment/symlink escapes, no credential inheritance, cancellation, app-start failure classification, two runs cannot corrupt a shared target, interrupted writes/restart, legacy evidence tests.
Acceptance: browser evidence proves execution against the correct isolated source; primary checkout untouched; run can be inspected after API restart.

### M2: Dynamic investigation and model-generated proposals

Tasks:
- Add list/search/read tools restricted to run source. Exclude secret files, dependencies and generated content; cap calls, bytes, result count and model context.
- Use RAG as optional context support, not authority for mutation. Bind indexes/context to the run snapshot; avoid retrieving stale primary-checkout source into isolated runs.
- Separate repair generation configuration from answer generation; record provider/model/prompt version and explicit provider errors. No silent fallback to a predefined patch.
- Implement structured proposals and edit policy. Initial mutation scope: MiniShop application `.ts`/`.tsx` files. Block tests, config, package scripts, dependencies, runner, evaluation labels and proof records.
- Run original reproduction before proposal application. Persist proposal and server-derived diff without writing application code.
- Remove case-001-specific branching from dynamic mode. Keep legacy fixture clearly separated.

Checks: malformed JSON, unsupported files, absolute/traversal/UNC/device paths on Windows, symlink/junction escapes, stale original content, ambiguous replacements, excessive edits, prompt injection attempts, provider timeout/missing credentials, non-cart case proposal.
Acceptance: a live model proposes a patch for a non-cart case without a stored solution; simulated provider tests remain explicitly simulated; no mutation before review.

### M3: Exact proposal review, application and independent verification

Tasks:
- Persist a reviewable proposal; approval resumes that exact proposal rather than regenerating it. Bind approval to all input/policy identities.
- Apply edits transactionally inside run workspace. Recheck original file hashes and baseline validity; retain original source and candidate diff.
- Run unchanged reproduction, MiniShop typecheck/build and relevant trusted regression tests. Configure required checks by policy, not by model suggestion alone.
- Record commands, execution context, exit codes, duration and artifacts for each check. Missing/skipped/failed checks block VERIFIED.
- Detect source/test changes during execution. Capture candidate fingerprint before and after checks. Freeze support/config/shared files according to policy.
- Dashboard shows generated diagnosis, assumptions, diff, approval action, check breakdown and failures. Remove cart-specific action in dynamic mode. Distinguish simulated, legacy and live runs.

Checks: altered proposal/hash, changed snapshot after review, approval replay, partial application failure, reproduction passes but regression fails, missing report, changed test, infrastructure failure, successful non-cart case.
Acceptance: exact reviewed patch verified in isolation, with all required checks and artifacts; failure states accurately rendered. Export diff for manual application; primary-checkout application is outside this milestone.

### M4: Bounded repair loop and observability

Tasks:
- Persist attempt records; restore original snapshot before each candidate. Feed bounded diagnostics to the model, not unrestricted logs or secrets.
- Enforce attempt/time/tool/context budgets and cancellation. Retry classification distinguishes invalid proposals, behaviour failures and environment failures.
- Collect token usage and stage latency where provider exposes them; report missing usage as unknown. Cost estimates require dated pricing configuration, never invented spend.
- Durable review pause/resume; on restart verify workspace and baseline identities before continuing. Evaluate a LangGraph checkpointer against installed version when implementing, not by assuming an API.

Checks: budget exhaustion, provider outage, restore failure, interrupted apply/verify, cancellation while process running, retry requests fresh review.
Acceptance: runs stop predictably and preserve an intelligible trace of every attempt.

### M5: Held-out repair evaluation and portfolio report

Tasks:
- Start with five supported bug variants of distinct root causes, then expand toward 10-20. Candidates: total aggregation, repeated-item quantity, removal, clear/reset, UI state rendering. Validate each defect/expected behaviour before admitting it; do not claim nonexistent features.
- Store versioned original source mutations and reports separately from independent acceptance tests and reference fixes. Apply defects only in evaluation workspaces.
- Split development and held-out cases before prompt tuning. Exclude labels, reference patches and held-out acceptance tests from model tools, RAG and diagnostics. Freeze split and dataset hashes.
- Compare deterministic legacy demo where applicable, a simple model proposal baseline, and the evidence-driven workflow under the same model/budget/starting state.
- Build `scripts/evaluate-repair.ts` with per-case/per-trial artifacts, stable seeds where supported, explicit provider settings and multiple trials where affordable.
- Metrics: verified repair rate over all scheduled cases, conditional success over executable cases, infrastructure exclusions shown separately, regression-free success, attempt distribution, unknown cost count, time and repeated-run consistency. Never hide failed trials in denominators.
- Evaluate live RAG separately on a larger held-out question set; provenance validity and factual support are different measures. Independent acceptance checks, not LLM grading alone, establish repair success.

Acceptance: evaluation command reproducible from documented setup; no solution leakage; real failures retained; report contains counts/denominators and limitations. No percentage claims based solely on simulated adapters.

### M6: Generated reproduction tests (after existing-test path is reliable)

Detailed implementation has moved to [arbitrary-bug-reproduction-plan.md](arbitrary-bug-reproduction-plan.md), with progress tracked in [docs/progress/arbitrary-bug-reproduction.md](../docs/progress/arbitrary-bug-reproduction.md). The requirements below remain the milestone summary.

Tasks:
- Generate a test proposal from report and application behaviour using controlled helpers. Review report/test correspondence before accepting a baseline.
- Treat tests as executable code: prefer a validated declarative action/assertion format compiled by trusted code for initial version. Raw TS generation requires stronger execution isolation; AST checks alone are insufficient.
- Permit test creation only in a dedicated pre-baseline phase. Freeze accepted test and dependencies before repair begins.
- Require a structured report-relevant behavioural failure on original source. An invalid selector, missing dependency or crash is an environment/test-generation failure.
- Reproduce again whenever test proposal changes. Independent held-out acceptance tests remain inaccessible to the model.

Acceptance: report -> generated accepted test -> recorded baseline failure -> generated patch -> same-test pass -> required checks pass on multiple cases. Unsupported/ambiguous reports stop with an explanation.

### M7: Portfolio packaging

Tasks:
- README documents actual architecture, one-command supported setup, live provider configuration, evaluation commands and limits. Align Node requirement with package.json (currently >=22).
- Add architecture diagram, short demo, representative before/after report, evaluation summary and failure analysis. Separate historical artifacts from current release proof.
- Attribute individual contributions accurately in team project documentation and resume wording.
- Add CI checks after inspecting existing automation; keep paid/provider evaluation explicit and credentials protected.

Acceptance: another developer can reproduce a supported dynamic run and evaluation; resume claims map to committed code and recorded evidence.

## Validation and evidence protocol for every implementation change

Follow the full AGENTS.md sequence for bug fixes: write focused reproduction, record original failure before application edits, confirm issue correspondence, minimal fix, same test again, relevant regressions. If assertion/test input changes, repeat baseline. New features need meaningful contract and integration checks; do not fabricate an old bug to justify feature work.

Use existing evidence runner for browser verification. Inspect the existing recording scripts and extend recording for required checks rather than treating console text or model prose as proof. Suggested milestone artifact root: `artifacts/dynamic-repair/<milestone>/<runId>/`, containing manifest, environment metadata without secrets, logs, reports and source/test identities. Actual layout must be recorded when implemented.

Existing commands to inspect/use when appropriate: `npm run test:unit`, `npm run typecheck`, `npm run build`, `npm run evidence:before`, `npm run evidence:after`, `npm run rag:evaluate`. Existing evidence scripts are demo-specific until adapted; do not assume they test a new case or isolated target. `npm run demo:seed` mutates source and clears demo data; never use casually on a dirty checkout. `npm run test` includes Playwright and requires the correct running target.

## Completion definition

Dynamic MVP = M0-M3: generated, reviewed proposals for more than one bug type, isolated execution, unchanged reproduction and required regression gates. Strong resume release = M0-M5 plus M7: measured held-out results, traces, failure analysis and reproducible demo. Generated-test release = M6 additionally. Keep all three claims distinct.

No milestone is complete from code inspection alone. Update progress.md with real checks, artifact links, unresolved failures, changed files and next action after each work session.
