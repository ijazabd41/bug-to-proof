> [!NOTE]
> **Historical Milestone Document**: This document represents a historical audit. For current architecture, verification matrix, and system status, see [Current Project Status](current-project-status.md).

# Project evaluation and implementation prompt

Review date: 2026-10-09. Scope: current local working tree, including existing uncommitted work. Application code was not changed for this review.

## Evaluation

The project has a strong foundation: isolated repair workspaces, exact proposal approval, baseline/after test identity checks, durable checkpoints, and a substantial test suite. The highest-value next step is hardening the boundaries around those mechanisms rather than adding another AI feature.

These are static code findings, not newly reproduced bugs:

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| High | Case updates lack runtime schema validation | `services/api/src/routes/cases.ts` casts PATCH bodies to `Partial<BugCase>` and merges reproduction/patch fields. Invalid `steps` or `preconditions` can be persisted; `CaseDetail.tsx` assumes arrays and calls `.map`. LLM structuring checks arrays but does not validate their elements. |
| High | Local API has broad exposure defaults | `services/api/src/index.ts` reflects arbitrary CORS origins, listens without an explicit host, and serves the entire artifacts tree. Mutating routes have no authentication. This creates exposure beyond the intended local demo; actual network reachability was not tested. |
| Medium | Legacy running cases lack restart recovery | Startup recovery in `runStore.ts` handles dynamic repair records, while reproduce/verify routes persist `REPRODUCING`/`VERIFYING` and reject subsequent runs in those states. No corresponding legacy-case startup reconciliation was found. |
| Medium | Repair dashboard does not restore saved runs | `AIAssistant.tsx` keeps the repair run only in component state; it does not load saved runs or call the cancel endpoint. Start/review requests await graph execution before returning, so the UI cannot show intermediate events or cancel through its current controls. |
| Medium | Case identity can collide | Creation uses `case-${Date.now()}` and persistence replaces the matching filename. Two creations within the same millisecond can overwrite a case. Frequency was not measured. |
| Medium | Persistence fallback loses atomicity | `caseStore.ts` falls back from rename to writing directly to the destination on EPERM/EBUSY. A crash during that write can leave invalid JSON, which reads silently treat as missing. This crash scenario was not executed. |
| Low | Repository and onboarding need cleanup | Generated `.js`, `.d.ts`, and maps are tracked beside dashboard TypeScript; run workspaces are not ignored by the current artifact rules. README requires Node >=18 while package engines require >=22. No `.github` CI directory was found. |

Current typecheck passed (exit 0). Fresh unit execution exited 1: nine tests passed, but numerous suites could not load because temporary Vite module files were missing (ENOENT); one suite reported a module-mocking error whose underlying cause remains unresolved. This is an incomplete verification run, not evidence that the application bugs above were reproduced. Logs and JSON are under `artifacts/project-review-2026-10-09/`. Historical system reports are evidence of previous executions, not proof of the current dirty tree. No new browser failure-to-pass workflow was run during this review.

## Ready-to-use prompt

```text
Improve the Bug-to-Proof project in D:\bug-to-proof using the findings in docs/project-review-prompt.md. Read AGENTS.md first and preserve existing uncommitted work. Work only in the configured local demo project. Do not deploy or merge.

First inspect the current source and independently validate each finding. Distinguish confirmed behavior failures, static findings, environment failures, and optional improvements. Prioritize the following work:

1. Add runtime schemas for case creation/update and LLM-produced reproduction fields. Validate string arrays, field lengths, test paths, patch structure, and allowed fields; reject malformed requests with clear 400 responses without changing the stored case. Keep results, evidence, and verification fields runner-owned. Replace timestamp-only IDs with collision-resistant IDs.
2. Restrict the API to loopback by default and allow only configured dashboard origins. Define a safe opt-in policy for non-local access. Limit public artifact delivery to required evidence rather than exposing internal run records, checkpoints, or workspace source. Preserve screenshot/trace/report links.
3. Reconcile legacy REPRODUCING/VERIFYING cases after process restart without inventing execution outcomes. Prevent deletion or conflicting updates during active execution, and prevent late LLM responses from overwriting newer user edits. Keep case persistence atomic under Windows contention; report corrupt records explicitly.
4. Restore repair runs when opening or refreshing a case, show progress and terminal states, and expose cancellation. Return a persisted run ID promptly from start operations, retrieve progress with bounded polling or streaming, filter runs by case, and stop updates on unmount. Preserve exact proposal ID/hash approval and all existing verification gates. Use appropriate 404/409 errors for missing runs and invalid state transitions.
5. Remove redundant generated source outputs only after checking consumers. Configure builds to keep outputs outside src. Add suitable ignore/retention rules for runtime artifacts while preserving curated evidence. Align README and package Node requirements. Add CI for typecheck, unit tests, production builds, and deterministic browser verification using the evidence runner.

For each behavior bug, create a focused reproduction and run it against unchanged application code before fixing it. Confirm the failure matches the issue, implement the smallest reasonable fix, rerun the same test, and run relevant regressions. If a reproduction changes, repeat baseline verification. Use the evidence runner for recorded browser verification. Never weaken assertions or claim an environment error is a reproduced bug.

Acceptance criteria: malformed inputs cannot corrupt cases; local API access defaults are constrained; interrupted legacy runs remain recoverable; saved repair proposals survive dashboard refresh; users can observe and cancel active runs; conflicting operations cannot overwrite newer state; existing baseline, fingerprint, source-manifest, approval, and regression gates continue to fail closed.

Deliver a prioritized findings report, minimal reviewable changes, actual command results with artifact paths, and remaining limitations. Keep historical, simulated, fresh unit, and fresh browser evidence clearly identified. Do not claim comprehensive correctness from passing unit tests alone.
```
