# Arbitrary bug reproduction progress

> This is the detailed engineering ledger. Its artifact links refer to generated local evidence that is intentionally excluded from the public Git repository. The sanitized public scorecard is [`docs/evidence/ar7-evaluation.md`](../evidence/ar7-evaluation.md).

Plan: [plans/arbitrary-bug-reproduction-plan.md](../../plans/arbitrary-bug-reproduction-plan.md)  
Status: **AR0–AR7 COMPLETE**
Last updated: 2026-10-14 (Asia/Karachi)

## Current capability boundary

- New reports are persisted and displayed.
- Structured report fields are persisted separately and completeness is visible in the dashboard.
- New cases remain testless until a generated candidate is reviewed and confirmed.
- Hash-bound approval freezes accepted compiler output, reruns it on unchanged source, and promotes a confirmed assertion failure to the case's trusted reproduction test.
- Existing predefined benchmark cases can use the evidence-backed repair workflow.
- The API can generate discovery-bound candidates, the dashboard can approve or reject them, and accepted tests retain their identity through isolated repair verification and proof export.
- AR7 produced a reproducible scorecard, executed the frozen held-out cohort once, retained every outcome, and verified the portfolio/demo package.

## Milestones

| ID | Deliverable | Status | Evidence |
| --- | --- | --- | --- |
| AR0 | Documentation, contracts, and baseline | COMPLETE | Contract/API/UI tests and command logs under [`artifacts/arbitrary-reproduction/ar0-baseline/`](../../artifacts/arbitrary-reproduction/ar0-baseline/) |
| AR1 | First-class report structure and completeness | COMPLETE | Focused tests and regression logs under [`artifacts/arbitrary-reproduction/ar1-report-structure/`](../../artifacts/arbitrary-reproduction/ar1-report-structure/) |
| AR2 | Target discovery inventory | COMPLETE | Deterministic discovery tests and regressions under [`artifacts/arbitrary-reproduction/ar2-target-discovery/`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/) |
| AR3 | Declarative DSL and deterministic compiler | COMPLETE | Contract/compiler tests and regressions under [`artifacts/arbitrary-reproduction/ar3-schema-compiler/`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/) |
| AR4 | Candidate generation and bounded execution | COMPLETE | Three distinct live MiniShop reports produced executable candidates through the real evidence runner; focused, API, dashboard, MiniShop, typecheck, build, and source-integrity evidence is under [`artifacts/arbitrary-reproduction/ar4-generation-execution/`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/) |
| AR5 | Human review and frozen baseline | COMPLETE | Hash-bound review, immutable accepted test, unchanged-source confirmation, case promotion, focused/regression checks, and live browser evidence under [`artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/) |
| AR6 | Repair and proof integration | COMPLETE | Accepted-test identity is preserved through real browser failure-to-pass verification, regressions, and a provenance-bearing proof bundle under [`artifacts/arbitrary-reproduction/ar6-repair-proof/`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/) |
| AR7 | Held-out evaluation and portfolio release | COMPLETE | Frozen split and retained live outcomes, scorecard, trusted-input correction, demo readiness, and portfolio materials under [`artifacts/arbitrary-reproduction/ar7-evaluation/`](../../artifacts/arbitrary-reproduction/ar7-evaluation/) and [`docs/`](../) |

## AR0 checklist

- [x] Inventory existing documentation and capability claims.
- [x] Create an authoritative documentation index.
- [x] Define bounded product scope and honest outcomes.
- [x] Design the run model, API, DSL, compiler, graph, UI, isolation, and evidence protocol.
- [x] Add focused tests proving a new case cannot reproduce without a test.
- [x] Record typecheck, unit, build, and attempted browser baseline under `artifacts/arbitrary-reproduction/ar0-baseline/`.
- [x] Define contracts in code without enabling arbitrary reproduction.
- [x] Review and freeze AR0 contracts before AR1.

## AR0 executed results (2026-10-12)

### Current limitation and focused baseline

New cases still persist `reproduction.testFile: ""`. The configured reproduction and dynamic repair endpoints refuse those cases before invoking the evidence runner. Before implementation, the focused suite failed at the intended product boundary: the contract module did not exist, both API responses lacked a stable `REPRODUCTION_TEST_REQUIRED` code, and the dashboard exposed an action that could only return the missing-test error.

Command: `npm.cmd run test:unit -- --run services/api/src/reproduction/contracts.test.ts services/api/src/routes/reproduce.test.ts services/api/src/routes/aiRepair.test.ts apps/dashboard/src/components/CaseDetail.test.tsx`

- Before: exit 1; 3 failed, 5 passed, plus the missing contract suite. Evidence: [`pre-implementation-focused-tests-npm-cmd.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/pre-implementation-focused-tests-npm-cmd.log).
- After: 4 files and 11 tests passed. PowerShell returned exit 1 only because it promoted Vitest's Vite configuration warning from stderr; the test result itself passed. Evidence: [`post-implementation-focused-tests.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/post-implementation-focused-tests.log).

### Regression checks

| Command | Outcome | Evidence |
| --- | --- | --- |
| `npm.cmd run typecheck` | PASS, exit 0 | [`typecheck.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/typecheck.log) |
| `npm.cmd run build` | PASS, exit 0; dashboard and MiniShop builds completed | [`build.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/build.log) |
| `npm.cmd run test:unit -- --no-file-parallelism` | Initial run: 202 passed; 2 startup tests failed before application startup because Node 24/Windows returned `uv_os_get_passwd ... ENOMEM` inside `tsx` | [`unit.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/unit.log) |
| same unit command with `NODE_OPTIONS=--require .../tsx-windows-userinfo-shim.cjs` | PASS, exit 0; 47 files, 204 tests | [`unit-with-shim.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/unit-with-shim.log) |
| focused startup regression with the same shim | PASS, exit 0; confirms the prior failures were environmental | [`startup-regression-with-shim.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/startup-regression-with-shim.log) |

### Evidence-runner browser attempt

The unchanged MiniShop was started on port 5174 and `npm.cmd run evidence:before` invoked the repository evidence runner. The runner returned `INFRASTRUCTURE_ERROR`, not `ASSERTION_FAILED`: Playwright Chromium revision `chromium_headless_shell-1243` was unavailable to the sandboxed runner. User-cache installs remained inaccessible and an explicit `C:\tmp\btp-playwright-browsers` installation timed out. No browser result is counted as a reproduced bug. Evidence: [`browser-evidence-runner-retry.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/browser-evidence-runner-retry.log), [`browser-evidence-runner-final.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/browser-evidence-runner-final.log), and [`browser-evidence-runner-success.log`](../../artifacts/arbitrary-reproduction/ar0-baseline/browser-evidence-runner-success.log). The final runner artifacts were `artifacts/portfolio-cart/before/afb9f5d9-39b7-435a-acb4-7e99716b4ffc/result.json` and its trace directory.

### Contracts frozen for AR1

- Durable reproduction runs are separate from the frozen legacy `BugCase` contract.
- Version `1.0` defines lifecycle states, allowed transitions, bounded defaults, report/target/discovery identities, attempts, accepted candidate hashes, baseline evidence, events, and API shapes.
- `REPRODUCED` is reachable only from `CONFIRMING_BASELINE`; invalid candidates, execution errors, and passing baselines cannot jump directly to it.
- AR0 does not create, compile, accept, or execute generated tests.

Changed source and test files: `services/api/src/reproduction/contracts.ts`, `services/api/src/reproduction/contracts.test.ts`, `services/api/src/routes/reproduce.ts`, `services/api/src/routes/reproduce.test.ts`, `services/api/src/routes/ai.ts`, `services/api/src/routes/aiRepair.test.ts`, `apps/dashboard/src/components/CaseDetail.tsx`, and `apps/dashboard/src/components/CaseDetail.test.tsx`.

Unresolved assumptions and risks:

- AR1 must define completeness rules and backward-compatible storage for first-class steps, expected behavior, actual behavior, starting path, and context.
- State transitions are contract-tested, but reproduction-run persistence and endpoints do not exist yet.
- Browser regression should be rerun when the exact Playwright Chromium revision is accessible. The infrastructure result does not invalidate the API/UI missing-test baseline.
- This host needs the evidence-only Node 24/Windows `tsx` shim; Node 22 or a corrected host should be checked separately.

Recommended next task: AR1 should add first-class report fields with migration and completeness validation, then expose precise clarification requirements without starting generation for incomplete reports.

## AR1 executed results (2026-10-12)

AR1 adds a backward-compatible `report` contract with `steps`, `expected`, `actual`, optional `startPath`, and optional `context`. Existing case JSON remains readable: the API derives the structured report from legacy reproduction fields without altering those fields. Completeness is derived from the three behavior facts required for later generation and never marks an incomplete report ready.

Implemented behavior:

- Case creation accepts bounded structured report fields and no longer concatenates them into `description`.
- Legacy records receive an in-memory version `1.0` report and completeness result when read.
- Creation and clarification responses expose `{ complete, missingFields }`.
- PATCH accepts a validated full report object, rejects external starting URLs, and recomputes completeness.
- The dashboard collects starting path and context, shows exact missing fields, and provides a clarification editor for incomplete reports.
- Existing configured reproduction tests and legacy reproduction fields remain unchanged.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Focused AR1 suite before implementation | Expected failure: 5 failed, 12 passed; missing modules, rejected structured fields, absent UI inputs | [`pre-implementation-focused-tests.log`](../../artifacts/arbitrary-reproduction/ar1-report-structure/pre-implementation-focused-tests.log) |
| Final focused suite covering completeness, migration, create/PATCH APIs, report form, clarification UI, and testless case UI | PASS: 6 files, 23 tests | [`focused-tests-after-type-fix.log`](../../artifacts/arbitrary-reproduction/ar1-report-structure/focused-tests-after-type-fix.log) |
| `npm.cmd run typecheck` | PASS, exit 0 | [`typecheck-pass.log`](../../artifacts/arbitrary-reproduction/ar1-report-structure/typecheck-pass.log) |
| `npm.cmd run test:unit -- --no-file-parallelism` with the recorded Node 24/Windows `tsx` shim | PASS: 51 files, 214 tests | [`unit.log`](../../artifacts/arbitrary-reproduction/ar1-report-structure/unit.log) |
| `npm.cmd run build` | PASS, exit 0; dashboard and MiniShop builds completed | [`build.log`](../../artifacts/arbitrary-reproduction/ar1-report-structure/build.log) |

AR1 unresolved assumptions:

- A non-empty step, expected behavior, and actual behavior establish syntactic completeness, not semantic clarity or reproducibility.
- `startPath` is optional and restricted to application-relative paths; AR2 must confirm it exists in the discovered route inventory.
- Legacy values are derived from existing reproduction metadata. The migration deliberately does not attempt to parse older concatenated prose into fields.
- Completeness does not start generation yet; generation remains gated on AR2–AR4.

Recommended next task: AR2 should snapshot the unchanged MiniShop target and build a bounded, sanitized route and accessibility inventory tied to a source fingerprint.

## AR2 executed results (2026-10-12)

AR2 adds deterministic, source-backed discovery for the configured isolated MiniShop snapshot. The inventory is bound to the existing source-manifest fingerprint and its own canonical SHA-256 digest, then can be atomically persisted as `discovery.json`.

Implemented behavior:

- Inventories application-relative React routes and links.
- Extracts bounded accessible buttons, links, textboxes, comboboxes, and headings from trusted source parsing.
- Records configured product fixture IDs, names, and prices.
- Removes balanced JSX expressions and excludes scripts and hidden inputs from inventory text.
- Rejects absolute/cross-origin/protocol-relative paths, symlinked inputs, excessive files, excessive bytes, excessive controls, and oversized text.
- Produces stable `sourceFingerprint` and `inventoryDigest` values; timestamps are excluded from digest computation.
- Atomically persists the exact snapshot and returns its artifact hash.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Focused discovery test before implementation | Expected failure: discovery module missing | [`pre-implementation-focused-tests.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/pre-implementation-focused-tests.log) |
| Configured MiniShop acceptance before parser correction | Expected failure exposed JSX `=>` parsing contamination; not an application defect | [`configured-minishop-focused-tests.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/configured-minishop-focused-tests.log) |
| Final focused discovery suite | PASS: 6/6, including real MiniShop routes, products, controls, limits, sanitization, cross-origin rejection, determinism, and persistence | [`focused-tests-after-type-fix.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/focused-tests-after-type-fix.log) |
| `npm.cmd run typecheck` | PASS, exit 0 | [`typecheck-pass.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/typecheck-pass.log) |
| First full unit run | 219 passed; one unrelated Windows workspace-lock cleanup assertion failed transiently | [`unit.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/unit.log) |
| Isolated workspace regression retry | PASS | [`workspace-regression-retry.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/workspace-regression-retry.log) |
| Full unit retry | PASS: 52 files, 220 tests | [`unit-retry.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/unit-retry.log) |
| `npm.cmd run build` | PASS, exit 0 | [`build.log`](../../artifacts/arbitrary-reproduction/ar2-target-discovery/build.log) |

AR2 limitations and assumptions:

- This is a trusted source-backed inventory, not a claim that every conditionally rendered runtime element is visible in every state.
- Runtime browser enrichment remains optional and must retain the same source fingerprint, route bounds, sanitization, and origin policy when added to the reproduction graph.
- Accessible names containing only dynamic runtime data may be omitted; AR3 definitions must reference only inventory entries actually present.
- The parser is deliberately bounded to the configured MiniShop TypeScript/React patterns and is not a general JSX compiler.

Recommended next task: AR3 should define the runtime-validated reproduction DSL, canonicalization and hashes, then compile supported actions/assertions deterministically into trusted Playwright bytes.

## AR3 executed results (2026-10-12)

AR3 adds a versioned data-only reproduction definition, strict runtime policy validation, stable canonicalization and hashes, and deterministic trusted Playwright source emission. It does not accept model output through an API, execute generated tests, or change reproduction lifecycle state.

Implemented behavior:

- Version `1.0` contracts cover bounded trusted preconditions, application-relative navigation, accessible-role clicks/waits, label-based fill/select operations, reload, and the documented assertion families.
- Validation rejects unknown keys and constructs, raw-code/evaluate actions, selector fields, external or protocol-relative paths, prototype-pollution keys, unsupported roles, non-ARIA attribute assertions, excessive bytes, excessive steps/mappings, and oversized strings.
- Canonical JSON recursively sorts object keys while preserving array order; the definition and compiled bytes receive SHA-256 hashes.
- Compiler version `1.0.0` derives stable test identity from definition ID, schema version, and canonical definition hash.
- Model-controlled strings are emitted only as JSON string data. Generated code imports only Playwright and uses fixed trusted helpers for locators, number normalization, evidence attachments, and structured `BTP_ASSERTION` failures.
- Persistence accepts bounded run IDs and atomically writes only to `<generatedRoot>/<runId>/generated-test/reproduction.spec.ts`, rejecting traversal and symlinked output directories.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Focused AR3 suite before implementation | Expected failure: compiler module missing; 0 tests collected | [`focused-before.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/focused-before.log) |
| Final focused AR3 contract/compiler suite | PASS: 1 file, 10 tests | [`focused-final.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/focused-final.log) |
| `npm.cmd run typecheck` | PASS, exit 0 for API, dashboard, and MiniShop | [`typecheck.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/typecheck.log) |
| Initial unsplit `npm.cmd run test:unit` | Harness timeout at 180 seconds before results; recorded as runner/environment timeout, not a product failure | [`unit-regression.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/unit-regression.log) |
| `npx.cmd vitest run --project api --maxWorkers 1` | PASS: 45 files, 218 tests | [`unit-api.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/unit-api.log) |
| `npx.cmd vitest run --project dashboard --project minishop --maxWorkers 1` | PASS: 8 files, 12 tests | [`unit-ui.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/unit-ui.log) |
| `npm.cmd run build` | PASS, exit 0; dashboard and MiniShop production builds completed | [`build.log`](../../artifacts/arbitrary-reproduction/ar3-schema-compiler/build.log) |

AR3 limitations and assumptions:

- Compilation proves policy enforcement and reproducible source bytes; it does not prove the emitted candidate is report-relevant or executable against a running target.
- The trusted `seedCart` helper currently defines a bounded storage operation contract. AR4 must bind it to the isolated MiniShop target and verify its runtime semantics before allowing generated candidates to use it.
- Accessible roles/names and paths are schema-valid but are not yet checked against the exact AR2 discovery snapshot; AR4 candidate validation must perform that binding before compilation/execution.
- Browser evidence was not rerun because AR3 adds no candidate execution path and the exact Playwright Chromium revision remains unavailable on this host. No browser result or arbitrary reproduction is claimed.

Changed AR3 source and test files: `services/api/src/reproduction/definitionCompiler.ts` and `services/api/src/reproduction/definitionCompiler.test.ts`. Evidence and this progress document are the only other AR3 additions.

Recommended next task: AR4 should bind definitions to the frozen report/target/discovery identities, add the provider adapter and durable bounded-attempt graph, execute candidates through the evidence runner, and classify selector/setup/runtime failures separately from report-relevant assertion failures.

## AR4 partial executed results (2026-10-12)

This increment establishes the bounded generation/execution path but does not satisfy AR4's live acceptance criterion. The configured host still lacks the required Playwright Chromium revision, and no live generation provider was configured for a three-report run.

Implemented behavior:

- A strict generation prompt exposes only the immutable report, sanitized AR2 inventory, prompt version, attempt number, and bounded prior diagnostics. It does not include benchmark specs, reference patches, or repository paths.
- Candidate policy validation binds routes, accessible controls/headings, and trusted cart product IDs to the exact frozen discovery snapshot before compilation.
- A durable atomic reproduction-run store supports restart reads, corruption failure, and newest-first case listings.
- Startup reconciliation marks interrupted discovery/generation/confirmation runs `BLOCKED` while preserving reviewable candidates.
- Bounded orchestration persists discovery, size-capped raw provider output, validation findings, compiler/test hashes, provider/model metadata, usage when available, diagnostics, classifications, events, and evidence artifact paths for up to three attempts.
- Incomplete reports stop at `NEEDS_REPORT_DETAILS`; cancellation stops at `CANCELLED`; provider/discovery failures stop honestly; invalid candidates and execution errors may retry only within the configured bound.
- Only a structured evidence-runner `ASSERTION_FAILED` candidate advances to `AWAITING_TEST_REVIEW`. `PASSED` becomes `BASELINE_PASSED`; selector, setup, timeout, cancellation, target, and other infrastructure failures cannot become `REPRODUCED`.
- The existing evidence runner now accepts compiler-owned specs only under an explicit generated-test root, fingerprints their bytes/runtime, creates a trusted generated Playwright config, and retains its existing timeout, cancellation, artifact, and input-change checks.
- New API endpoints start/list/read/cancel reproduction runs. Creation returns `202`; generation remains provider-configured and asynchronous.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Initial AR4 focused suite | Expected failure: three missing implementation modules; 0 tests collected | [`focused-before.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/focused-before.log) |
| Final AR2–AR4 focused contracts | PASS: 5 files, 23 tests | [`focused-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/focused-final.log) |
| Generated-test evidence-runner boundary | PASS: 2 tests; contained compiled spec produced a cancellation manifest as `INFRASTRUCTURE_ERROR`, and an out-of-root spec was rejected | [`evidence-runner-boundary.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/evidence-runner-boundary.log) |
| Reproduction-run API routes | PASS: 3 tests covering asynchronous `202`, completeness refusal, list, and read | [`api-routes.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/api-routes.log) |
| Persistence/API final check | PASS: 2 files, 6 tests including restart recovery, corruption, atomic persistence, API start/list/read, and completeness gating | [`persistence-api-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/persistence-api-final.log) |
| `npm.cmd run typecheck` | PASS, exit 0 for API, dashboard, and MiniShop | [`typecheck-all.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/typecheck-all.log) |
| First API regression | 48/49 files and 224 tests passed; one Vitest worker exited with Windows code `3221226505` while starting `aiRepair.test.ts`, with no assertion failure | [`unit-api.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/unit-api.log) |
| Isolated `aiRepair.test.ts` retry | PASS: 6/6 | [`ai-repair-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/ai-repair-retry.log) |
| Full API retry | PASS: 49 files, 227 tests | [`unit-api-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/unit-api-retry.log) |
| `npm.cmd run build` | PASS, exit 0; dashboard and MiniShop production builds completed | [`build.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/build.log) |
| Final API typecheck after route tests | PASS, exit 0 | [`typecheck-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/typecheck-final.log) |
| Final orchestration check after raw-output artifact bound | PASS: 3 tests; API typecheck also passed | [`service-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/service-final.log) |

AR4 remaining acceptance work and risks:

- The three report fixtures exercised provider and runner adapters with controlled outputs; they are not live-model accuracy or browser execution evidence.
- The exact Playwright Chromium revision must be available before three distinct MiniShop candidates can be run and classified end to end.
- A generation provider must be explicitly configured; disabled or empty providers fail closed.
- The dashboard starts generation for complete testless reports, displays and polls durable reproduction-run records, supports durable cancellation, distinguishes lifecycle outcomes, and deliberately withholds AR5 acceptance controls.
- Review, hash-bound acceptance, frozen baseline confirmation, and `REPRODUCED` remain AR5 responsibilities. Current candidates stop at `AWAITING_TEST_REVIEW`.

Recommended next task: finish AR4 acceptance by configuring a provider and browser to record three distinct live MiniShop candidate executions. Do not begin AR5 review acceptance until those outcomes are recorded and selector/setup failures are confirmed non-reproductions.

### AR4 integrity hardening executed results (2026-10-12)

This increment hardens attempt and execution integrity without claiming AR4 completion.

- Candidate executions now use stable `<run>-attempt-<n>` identities, separate compiled-test and evidence directories, and durable attempts retain the definition, compiled spec reference, raw provider output, execution artifacts, and structured failure kind. Target/browser/input-integrity failures are preserved and are not retried as model failures.
- Generated Playwright configuration is rewritten atomically from deterministic trusted bytes, included in the generated-input fingerprint, and checked with the spec after execution.
- MiniShop source identity is recomputed before compilation, immediately before execution, and after execution. A mismatch is persisted as `BLOCKED` / `INPUTS_CHANGED` with the candidate retained.
- Unexpected compiler/runner exceptions persist a bounded `BLOCKED` record; route-level asynchronous failures also fail closed. Cancellation is persisted before the API returns and repeated cancellation is idempotent.
- Runner results now carry structured failure kinds: `TARGET_UNREACHABLE`, `BROWSER_UNAVAILABLE`, `EXECUTION_TIMEOUT`, `CANCELLED`, `SELECTOR_OR_ACTION_ERROR`, `INVALID_REPORT`, and `INPUTS_CHANGED`.
- Durable run reads validate runtime structure and preserve invalid files for investigation. Artifact references exposed by run records are relative and containment-checked.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Focused integrity suite before fixes | Expected failure: 8 assertions covering missing failure kinds, config fingerprinting, schema validation, outage preservation, and attempt identities | [`integrity-focused-before.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/integrity-focused-before.log) |
| Final integrity/API/generated-runner suite | PASS: 6 files, 42 tests | [`integrity-focused-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/integrity-focused-final.log) |
| Real generated Playwright runner | PASS: 3 tests; the controlled run started the real CLI and classified missing Chromium as `BROWSER_UNAVAILABLE`, not reproduction | [`real-generated-runner.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/real-generated-runner.log) |
| Full API regression attempt | Timed out at the command limit after two process-lifecycle tests exceeded their per-test timing under the combined run; no product assertion was counted as a reproduced bug | [`api-regression-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/api-regression-final.log) |
| Isolated retries of the two timed-out API files | PASS: 2 files, 6 tests | [`api-timeout-retries.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/api-timeout-retries.log) |
| `npm.cmd run typecheck` | PASS for API, dashboard, and MiniShop after minimal compatibility fixes in the existing AR4 dashboard work | [`typecheck-final-hardening.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/typecheck-final-hardening.log) |
| `npm.cmd run build` | PASS for dashboard and MiniShop | [`build-final-hardening.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/build-final-hardening.log) |

Availability and acceptance status:

- No generation provider configuration is present (`RAG_GENERATION_PROVIDER`, model/key settings, and legacy LLM settings are unset), so no live-model report run was attempted.
- The required Playwright Chromium revision (`chromium-1243`) is absent at the configured executable path. The real generated-runner check therefore remains an infrastructure result, not a mocked assertion result.
- No three-report live acceptance attempts or durable live attempt artifact directories exist for this increment. AR4 remains **IN PROGRESS**.

Recommended next task: configure a real generation provider and install the exact Playwright Chromium revision, then run and retain three distinct complete MiniShop reports end to end. Do not start AR5 until those live outcomes are recorded.

### AR4 dashboard and prerequisite verification (2026-10-12)

- Focused dashboard contracts now cover complete and incomplete testless reports, configured-test compatibility, asynchronous `202` handling, active-only polling, cleanup across unmount/case changes, durable cancellation refresh, distinct lifecycle treatments, the AR5 control boundary, and honest API failures that preserve the last durable state.
- The exact Playwright Chromium revision was installed into the explicit writable cache `C:\tmp\btp-playwright-browsers`. With `PLAYWRIGHT_BROWSERS_PATH` set to that directory, `chromium.executablePath()` resolves to `C:\tmp\btp-playwright-browsers\chromium-1243\chrome-win64\chrome.exe` and the file exists.
- The controlled compiled-spec integration ran through the real Playwright CLI with that browser and passed its classification contract. This is runner integration evidence, not live-model acceptance.
- No supported live generation provider is configured: `RAG_GENERATION_PROVIDER`, `RAG_GENERATION_MODEL`, provider key variables, and legacy LLM settings are all absent. No credentials were invented, logged, or persisted.
- Because the provider prerequisite remains unavailable, no three-report live acceptance run was started and no live attempt directories were created. AR4 remains **IN PROGRESS**.

Executed evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Dashboard lifecycle contracts before fixes | Expected failure: 3 product assertions (case-change polling cleanup, distinct state treatments, and visible polling errors); 6 passed | [`dashboard-lifecycle-before.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/dashboard-lifecycle-before.log) |
| Dashboard lifecycle contracts after fixes | PASS: 1 file, 9 tests | [`dashboard-lifecycle-after.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/dashboard-lifecycle-after.log) |
| Provider/browser presence check | Browser absent before install; all supported provider/model/key flags absent (values not printed) | [`prerequisites-before.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/prerequisites-before.log) |
| Exact Chromium verification after install | PASS: package-resolved executable exists in the explicit browser cache | [`browser-after-install.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/browser-after-install.log) |
| Real generated-runner integration with installed browser | PASS: 1 file, 3 tests | [`real-generated-runner-with-browser.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/real-generated-runner-with-browser.log) |
| Dashboard plus focused AR4 regression | PASS: 12 files, 58 tests | [`dashboard-ar4-focused-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/dashboard-ar4-focused-final.log) |
| Full API project regression with increased timeout | PASS: 50 files, 251 tests | [`api-regression-browser-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/api-regression-browser-final.log) |
| MiniShop tests | PASS: 2 files, 4 tests | [`minishop-tests-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/minishop-tests-final.log) |
| Full typecheck | PASS: API, dashboard, and MiniShop | [`typecheck-dashboard-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/typecheck-dashboard-final.log) |
| Production builds | PASS: dashboard and MiniShop | [`build-dashboard-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/build-dashboard-final.log) |
| `git diff --check` | PASS; line-ending warnings only | [`git-diff-check.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/git-diff-check.log) |

Remaining acceptance blocker: configure a supported real provider and model, with its credential supplied through the environment. Then run three distinct complete MiniShop reports through the durable API and real evidence runner. Do not begin AR5 until those outcomes and denominators are retained.

### AR4 live acceptance prerequisite recheck (2026-10-13)

- The required Chromium executable remains available at `C:\tmp\btp-playwright-browsers\chromium-1243\chrome-win64\chrome.exe` when `PLAYWRIGHT_BROWSERS_PATH` points to `C:\tmp\btp-playwright-browsers`.
- The repository `.env` contains non-empty legacy model and credential settings, but the effective generation configuration resolves to `disabled`. No explicit `RAG_GENERATION_PROVIDER` is configured and the legacy enablement path is not active.
- The strict-JSON wrapper therefore returned locally without contacting a provider. Cancellation returned an empty response through the disabled-provider guard, and no live timeout behavior could be established. These are not provider-preflight passes.
- No cases or reproduction runs were created, no live attempt artifacts exist, and no post-run regression suite was required. Aggregate live denominators remain zero.
- AR4 remains **IN PROGRESS**. AR5 was not started.

Executed evidence:

| Check | Outcome | Evidence |
| --- | --- | --- |
| Sanitized live-provider preflight | BLOCKED before any provider request: effective provider `disabled`; strict JSON and live timeout were not exercised | [`live-provider-preflight.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-provider-preflight.log) |
| Sanitized prerequisite snapshot | Browser available; effective provider disabled; 0 live reports submitted | [`live-acceptance-blocked-2026-10-13.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-acceptance-blocked-2026-10-13.log) |

Required next configuration (choose one real path):

- Existing legacy adapter: set `LLM_ENABLED=true` and retain non-empty `LLM_MODEL` and `LLM_API_KEY`; set `LLM_API_URL` only when using a non-default OpenAI-compatible endpoint.
- OpenAI-compatible adapter: set `RAG_GENERATION_PROVIDER=openai`, `RAG_GENERATION_MODEL=<model>`, and `RAG_GENERATION_API_KEY=<secret>`; optionally set `RAG_GENERATION_BASE_URL`.
- Local Ollama adapter: set `RAG_GENERATION_PROVIDER=ollama` and `RAG_GENERATION_MODEL=<installed-model>`; optionally set `RAG_GENERATION_BASE_URL` when it is not `http://localhost:11434`.

### AR4 authorized live-provider acceptance (2026-10-13)

The existing legacy provider was explicitly enabled locally by changing only `LLM_ENABLED` to `true`. Existing model, credential, and endpoint values were retained without printing or copying them. The effective provider was `legacy` with model `openai/gpt-oss-20b`.

Provider preflight:

- The sandboxed request failed with a network `EACCES`; the same harmless request was retried through the normal escalation boundary.
- The escalated preflight returned the required strict JSON, immediate cancellation returned safely, and a forced timeout was observed. Only sanitized provider/model and boolean outcomes were saved.
- Chromium 1243 and MiniShop were reachable for live execution. MiniShop was bound to `localhost:5174`; the API was reachable at `127.0.0.1:3001`.

The first three-report batch preserved two provider failures and three invalid cart candidates. The invalid definitions exposed an actionable prompt-contract defect: the model was told to emit schema version `1.0` without receiving the allowed object shapes. The same live evidence served as the failing baseline. The prompt was minimally amended to include only the strict DSL keys and allowed precondition/action/assertion shapes; no repository artifacts, tests, fixes, or patches were added to model context. Its focused test passed before live reruns.

Live run outcomes retained across all attempts:

| Category | Case | Run | Outcome |
| --- | --- | --- | --- |
| Calculation/state, initial | `case-1791834474465-v5af5tqm` | `7522fc80-651a-4cb5-908f-03f760f27a7b` | `BLOCKED`; empty provider response, 0 attempts |
| Cart removal, initial | `case-1791834487328-my3ab37h` | `deb10b7d-b123-4e71-b8a6-65a8dd6afe0e` | `CANDIDATE_INVALID`; 3 preserved invalid attempts |
| Navigation, initial | `case-1791834497679-811e0f2l` | `05946a52-6cf2-4dbd-8aa6-b10f93547151` | `BLOCKED`; empty provider response, 0 attempts |
| Calculation/state, schema-prompt rerun | `case-1791834688378-6az2xjp9` | `2ce4bdd4-70ff-40c5-94c9-328876ce5e50` | `BLOCKED`; empty provider response, 0 attempts |
| Cart removal, schema-prompt rerun | `case-1791834704843-7xg3en6m` | `c0582052-5a6f-4006-91a5-c3093ef44882` | `CANDIDATE_EXECUTION_ERROR`; attempt 1 invalid, attempts 2–3 schema-valid and executed, both `SELECTOR_OR_ACTION_ERROR` |
| Navigation, schema-prompt rerun | `case-1791834771825-wh5ynp1g` | `6e4f32a2-5758-4d35-8273-11cb59774cb5` | `BASELINE_PASSED`; attempt 1 invalid, attempt 2 selector error, attempt 3 schema-valid and passed |
| Calculation/state, new-case retry | `case-1791834872639-wdq7dsy2` | `6f4aa39c-7e6b-4a4b-91f7-5eb33950a597` | `BLOCKED`; empty provider response, 0 attempts |
| Calculation/state, recovered-provider retry | `case-1791834872639-wdq7dsy2` | `f956e479-c8a9-4443-a2f2-526c539efe7b` | `BLOCKED`; empty provider response, 0 attempts |

All nine model-output attempts have unique `<run>-attempt-<n>` identities. Four schema-valid, discovery-bound candidates were compiled and invoked through the real Playwright runner. Three were correctly classified as selector/action errors and one as a passing baseline; none was counted as reproduction and no run reached `REPRODUCED` or `AWAITING_TEST_REVIEW`. Runner manifests, JSON reports, screenshots, and traces were retained for failed browser attempts. Raw provider output remains bounded, non-executable audit data.

The source fingerprint remained `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289` before, throughout, and after the live runs. The discovery inventory digest remained `2f7855d90514749e47c0c4c59e9dbfbd19ffbacee0548df05e5b3953e7f48489`. Definition, compiler, compiled-test, trusted-config, and runner-input fingerprints plus artifact paths are recorded per attempt in the aggregate evidence.

Aggregate denominator over the complete preserved session:

- 7 distinct reports/cases and 8 durable runs submitted.
- 3 runs returned provider output; 5 runs failed before an attempt because generation returned empty. The successful runs retained 9 provider outputs/attempts.
- 4 valid candidates; 4 compiled/executed candidates; 5 invalid candidates.
- 0 structured assertion failures; 1 passing baseline; 3 selector/action errors.
- 0 target/browser/input-change infrastructure failures; 0 unsupported outcomes.
- Attempts per run: `0, 3, 0, 0, 3, 3, 0, 0`.

Executed regression evidence:

| Command/check | Outcome | Evidence |
| --- | --- | --- |
| Live provider preflight | PASS after network escalation: strict JSON, cancellation, timeout | [`live-provider-preflight-enabled.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-provider-preflight-enabled.log) |
| Prompt schema focused check | PASS: 2 files, 12 tests | [`prompt-schema-focused.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/prompt-schema-focused.log) |
| Focused AR4 service/API/runner suite | PASS: 12 files, 66 tests | [`live-focused-ar4.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-focused-ar4.log) |
| Dashboard lifecycle suite | PASS: 3 files, 11 tests | [`live-dashboard-lifecycle.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-dashboard-lifecycle.log) |
| Full API project regression | PASS: 51 files, 252 tests | [`live-api-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-api-regression.log) |
| Full dashboard tests | PASS: 6 files, 16 tests | [`live-dashboard-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-dashboard-regression.log) |
| MiniShop tests | PASS: 2 files, 4 tests | [`live-minishop-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-minishop-regression.log) |
| Full typecheck | Initial test-fixture literal mismatch corrected; retry PASS for API, dashboard, and MiniShop | [`live-typecheck.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-typecheck.log), [`live-typecheck-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-typecheck-retry.log) |
| Production builds | PASS: dashboard and MiniShop | [`live-build.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-build.log) |
| Final prompt contract after typecheck fixture correction | PASS: 1 test | [`live-prompt-contract-final.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-prompt-contract-final.log) |
| `git diff --check` | PASS; line-ending warnings only | [`live-git-diff-check.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-git-diff-check.log) |
| Full live denominator and per-attempt identity/hash/artifact audit | Recorded | [`live-acceptance-aggregate.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/live-acceptance-aggregate.json) |

AR4 remains **IN PROGRESS**. The live legacy provider did not produce a candidate for the calculation/state report despite separately retained operational retries, and only two of the three required categories produced valid candidates that reached the real runner. The discovered accessible inventory also exposes ambiguous repeated `Add to Cart` names, while the current DSL cannot disambiguate a product-scoped control; those selector failures were correctly retained instead of being counted as reproduction. AR5 was not started.

Recommended next task: harden the provider adapter so successful HTTP responses with absent/empty `message.content` retain a sanitized response-shape classification, then add a trusted discovery-bound way to target repeated product controls (without arbitrary selectors). Repeat three fresh live reports only after focused failing contracts and regression checks for those two gaps.

### AR4 continuation — provider diagnostics and discovery-bound repeated controls (2026-10-13)

Status: **IN PROGRESS**. This increment was implemented and locally verified, but the fresh live acceptance did not produce any executable candidate, so AR4 acceptance is not satisfied.

Implemented changes:

- Added a sanitized OpenAI-compatible response-shape result that records only structural classifications such as `content_missing`, `content_string_empty`, `content_not_string`, or `http_error:429`; provider IDs, raw response objects, credentials, and headers are not retained in this diagnostic.
- Successful HTTP responses with absent, empty, or non-string `message.content` are retained as `CANDIDATE_INVALID` attempts and consume the bounded candidate retry budget. HTTP/provider failures remain generation infrastructure failures and stop as `BLOCKED`; they are not counted as candidate failures or reproductions.
- Added the trusted locator context `{ "kind": "product", "productId": number }` for `click` and `waitForVisible`. The schema rejects other context kinds and unknown keys, discovery binds repeated product-template buttons to frozen fixture IDs/names, policy rejects unsupported and ambiguous unscoped matches, and the compiler emits only the fixed MiniShop `data-testid` lookup. Arbitrary CSS, XPath, JavaScript, URLs, and model-supplied selectors remain unsupported.
- Existing unscoped role/name actions, configured-test reproduction, and generated-test execution remain compatible.

Focused baseline and verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| `npx.cmd vitest run services/api/src/llm/client.test.ts services/api/src/reproduction/reproductionService.test.ts services/api/src/reproduction/candidatePolicy.test.ts services/api/src/reproduction/definitionCompiler.test.ts --no-file-parallelism` before production edits | Expected failure: 4 focused contracts failed (missing response diagnostic, no lifecycle retention, no scoped schema/compiler support, no ambiguity policy) | [`pre-implementation-provider-and-scoped-locator.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/pre-implementation-provider-and-scoped-locator.log) |
| Six-file provider/schema/discovery/service suite after implementation | PASS: 6 files, 39 tests | [`provider-and-scoped-locator-focused-first.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/provider-and-scoped-locator-focused-first.log) |
| Final provider/schema/discovery/service/routes/runner/classification suite | PASS: 13 files, 74 tests | [`final-focused-ar4.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-focused-ar4.log) |
| Corrected HTTP-vs-success boundary focused suite | PASS: 14 files, 78 tests | [`final-focused-ar4-after-http-boundary.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-focused-ar4-after-http-boundary.log) |
| `npm.cmd run typecheck` after final boundary correction | PASS: API, dashboard, MiniShop | [`final-typecheck-after-http-boundary.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-typecheck-after-http-boundary.log) |

Regression verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| `npx.cmd vitest run --project api --no-file-parallelism` | Initial unshimmed runs: 255/257 passed; two child-process startup tests failed before application load because `uv_os_get_passwd` returned Windows `ENOMEM`. Isolated retry with the existing Windows shim passed 2/2. | [`final-api-regression-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-api-regression-retry.log), [`startup-regression-env-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/startup-regression-env-retry.log) |
| `$env:NODE_OPTIONS='--require .../tsx-windows-userinfo-shim.cjs'; npx.cmd vitest run --project api --no-file-parallelism` after final correction | PASS: 52 files, 261 tests | [`final-api-regression-after-http-boundary.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-api-regression-after-http-boundary.log) |
| `npx.cmd vitest run --project dashboard --no-file-parallelism` | PASS: 6 files, 16 tests, including dashboard lifecycle | [`final-dashboard-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-dashboard-regression.log) |
| `npx.cmd vitest run --project minishop --no-file-parallelism` | PASS: 2 files, 4 tests | [`final-minishop-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-minishop-regression.log) |
| `npm.cmd run build` | PASS: dashboard and MiniShop production builds | [`final-build.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-build.log) |
| `git diff --check` | PASS; line-ending warnings only | Executed after corrected live audit |

Fresh live evidence:

- The first service-start attempt did not submit reports because readiness checked MiniShop at `127.0.0.1` while Vite was bound to `localhost`; both services had started, and the command stopped them in `finally`. This is retained as a startup/environment result in [`final-live-api.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-live-api.log) and [`final-live-minishop.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-live-minishop.log).
- A first three-report set exposed that HTTP 429 was incorrectly consuming candidate retries. Those runs are retained under [`final-live-acceptance/`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-live-acceptance/) but are not counted as final acceptance evidence. The adapter boundary was corrected and all affected focused, typecheck, and API checks were repeated.
- The corrected fresh set submitted calculation/state, cart/action, and navigation reports. Calculation ended `CANDIDATE_INVALID` after three retained attempts: one malformed assertion, one discovery-policy rejection, and one successful HTTP response with `content_string_empty`. Cart/action retained one invalid discovery-bound attempt and then stopped `BLOCKED` on sanitized `http_error:429`. Navigation stopped `BLOCKED` on sanitized `http_error:429` before a candidate attempt was created.
- Corrected live denominator: 3 reports/runs, 4 retained candidate attempts, 0 valid candidates, 0 executable candidates, 0 evidence-runner executions, 1 `CANDIDATE_INVALID` terminal state, and 2 provider-infrastructure `BLOCKED` states. No run reached `AWAITING_TEST_REVIEW` or `REPRODUCED`.
- Every final state is backed by its durable `run.json`, raw candidate artifact when provider text existed, response-shape diagnostic, events, and stop reason. The corrected aggregate is [`aggregate.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-live-acceptance-corrected/aggregate.json); per-run records and submitted IDs are under [`final-live-acceptance-corrected/`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-live-acceptance-corrected/).
- MiniShop source fingerprint before and after corrected live execution was `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`; configured source was unchanged.

Files changed in this increment:

- `services/api/src/llm/client.ts`
- `services/api/src/llm/client.test.ts`
- `services/api/src/reproduction/contracts.ts`
- `services/api/src/reproduction/targetDiscovery.ts`
- `services/api/src/reproduction/targetDiscovery.test.ts`
- `services/api/src/reproduction/definitionCompiler.ts`
- `services/api/src/reproduction/definitionCompiler.test.ts`
- `services/api/src/reproduction/candidatePolicy.ts`
- `services/api/src/reproduction/candidatePolicy.test.ts`
- `services/api/src/reproduction/generationProvider.ts`
- `services/api/src/reproduction/generationProviderDiagnostics.test.ts`
- `services/api/src/reproduction/reproductionService.ts`
- `services/api/src/reproduction/reproductionService.test.ts`
- `docs/progress/arbitrary-bug-reproduction.md`
- Recorded scripts/logs/run artifacts under `artifacts/arbitrary-reproduction/ar4-generation-execution/` and evidence-runner outputs under `artifacts/reproduction-runs/`.

Remaining limitation and assumption:

- The product-scoped repeated-control contract is implemented and verified locally, but the live provider did not emit a valid scoped definition in the corrected acceptance set. Therefore the requirement that three distinct MiniShop reports produce executable candidates without reference-test access remains unmet.
- Provider rate limiting (`http_error:429`) prevented two corrected runs from exhausting normal candidate generation. The calculation run also shows prompt/model conformance remains insufficient even when provider content is present.
- AR5 must not start. The next task remains AR4: improve schema-conformant generation and retry scheduling without weakening discovery validation, wait for provider capacity, then repeat three fresh live categories and require all three to produce executable candidates that reach the real evidence runner.

### AR4 completion — discovery-bound target inventory and live execution (2026-10-14)

Status: **COMPLETE**. The remaining limitation was not runner availability but expressiveness: discovery exposed repeated accessible names while the trusted contract could not refer to report-relevant `data-testid` targets such as totals, quantities, remove actions, and navigation. The provider consequently invented or combined unsupported locators, and the previous `seedCart` compiler also wrote a storage shape that did not match MiniShop runtime data.

Implemented changes:

- Discovery now records a sanitized exact target inventory from literal `data-testid` attributes and expands bounded product-ID templates from frozen fixtures. The inventory is included in its canonical digest.
- The data-only DSL supports trusted `clickTarget` and `waitForTargetVisible` actions plus target text, number, currency, and visibility assertions. The compiler emits only `page.getByTestId(...)`; CSS, XPath, JavaScript, and arbitrary selectors remain impossible.
- Candidate policy requires exact target-inventory membership before compilation, so invented targets are rejected before execution. Existing role/name locators, product-scoped repeated controls, configured tests, and prior generated definitions remain compatible.
- Missing assertion targets are recorded as the deterministic value `<missing>` and become structured `BTP_ASSERTION` evidence instead of selector timeouts. This permits deletion defects to be represented honestly without treating selector failures as reproduction.
- `seedCart` now uses the discovered trusted add-to-cart UI instead of writing an incompatible local-storage object.
- The generation prompt exposes the bounded target inventory and exact target schemas, requires one report-mapped assertion, avoids redundant waits/setup, and receives a 2,048-token provider output budget. Provider response diagnostics remain sanitized and retain no raw response object, credential, or header.

Focused baseline and final verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Target-inventory/compiler/policy/provider focused suite before implementation | Expected contract failures were observed; the unshimmed launcher also recorded Windows `EPERM`, so the shimmed baseline was retained separately | [`pre-implementation-inventory-targets.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/pre-implementation-inventory-targets.log), [`pre-implementation-inventory-targets-shim.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/pre-implementation-inventory-targets-shim.log) |
| Target inventory focused suite after implementation | PASS: 4 files, 25 tests | [`inventory-targets-focused-escalated.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/inventory-targets-focused-escalated.log) |
| Provider/schema/discovery/service non-browser suite | PASS: 13 files, 78 tests | [`inventory-targets-focused-no-browser.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/inventory-targets-focused-no-browser.log) |
| Trusted target runtime semantics | PASS: 4 files, 26 tests | [`trusted-target-runtime-focused.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-focused.log) |
| Real evidence runner missing-target assertion | PASS: 1 executed, 4 skipped; produced structured `<missing>` assertion evidence | [`trusted-target-missing-evidence.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-missing-evidence.log) |
| Provider output-budget contract | PASS: 4 files, 23 tests | [`provider-budget-focused.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/provider-budget-focused.log) |
| Final provider/schema/discovery/service/routes/evidence-runner/classification matrix | PASS: 14 files, 84 tests | [`final-inventory-runtime-focused.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-focused.log) |

Final regression verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| `$env:NODE_OPTIONS='--require .../tsx-windows-userinfo-shim.cjs'; npx.cmd vitest run --project api --no-file-parallelism` | PASS: 52 files, 267 tests | [`final-inventory-runtime-api-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-api-regression.log) |
| `npx.cmd vitest run --project dashboard --no-file-parallelism` | PASS: 6 files, 16 tests, including dashboard lifecycle | [`final-inventory-runtime-dashboard-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-dashboard-regression.log) |
| `npx.cmd vitest run --project minishop --no-file-parallelism` | Concurrent run passed one file but its next worker timed out during startup; isolated unchanged retry PASS: 2 files, 4 tests | [`final-inventory-runtime-minishop-regression.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-minishop-regression.log), [`final-inventory-runtime-minishop-regression-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-minishop-regression-retry.log) |
| `npm.cmd run typecheck` | PASS: API, dashboard, MiniShop | [`final-inventory-runtime-typecheck.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-typecheck.log) |
| `npm.cmd run build` | Initial sandbox run was blocked by Vite `EPERM` realpath; identical unrestricted retry PASS: dashboard and MiniShop | [`final-inventory-runtime-build.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-build.log), [`final-inventory-runtime-build-retry.log`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/final-inventory-runtime-build-retry.log) |

Fresh live acceptance:

| Category | Case | Reproduction run | Final state | Retained evidence |
| --- | --- | --- | --- | --- |
| Calculation/state | `case-1791917776888-hvza72c3` | `8dca2a60-8416-40e4-a4e6-e7de42948cf4` | `AWAITING_TEST_REVIEW`; structured `ASSERTION_FAILED`, expected 15 and received 10 | [`run.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-retries/calculation-state-case-1791917776888-hvza72c3-8dca2a60-8416-40e4-a4e6-e7de42948cf4/run.json), [`result.json`](../../artifacts/reproduction-runs/8dca2a60-8416-40e4-a4e6-e7de42948cf4-attempt-1/evidence/result.json) |
| Cart/action | `case-1791917801583-urha9nkd` | `c96b9eb4-304e-4b38-ac4d-4096a6435fc0` | `AWAITING_TEST_REVIEW`; structured `ASSERTION_FAILED`, expected quantity 1 and received `<missing>` | [`run.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-retries/cart-action-case-1791917801583-urha9nkd-c96b9eb4-304e-4b38-ac4d-4096a6435fc0/run.json), [`result.json`](../../artifacts/reproduction-runs/c96b9eb4-304e-4b38-ac4d-4096a6435fc0-attempt-1/evidence/result.json) |
| Navigation | `case-1791917827903-dh7fk4p5` | `7969bb48-1d36-4114-8883-35a88b812516` | `BASELINE_PASSED`; URL assertion expected and received `/cart`, so no bug was claimed | [`run.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-retries/navigation-case-1791917827903-dh7fk4p5-7969bb48-1d36-4114-8883-35a88b812516/run.json), [`result.json`](../../artifacts/reproduction-runs/7969bb48-1d36-4114-8883-35a88b812516-attempt-1/evidence/result.json) |

All three distinct reports produced schema-valid candidates, compiled through the trusted compiler, and reached the real evidence runner without reference-test access. Two report-relevant assertion failures moved to review; the navigation baseline passed and was retained as a non-reproduction. No selector/action failure was counted as reproduction. The audited denominator, hashes, and artifact references are in [`acceptance-summary.json`](../../artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-retries/acceptance-summary.json).

The MiniShop source fingerprint remained `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289` before and after live execution. The final inventory digest was `17822468a35e921c7b66b92c24f728bea1f78d9cc91244bd9ca7ef361545e86b`, containing 25 exact targets. The configured source application was unchanged.

Remaining assumptions and risks:

- Live-provider conformance and rate limits are external and remain variable; bounded retries, sanitized diagnostics, and honest `BLOCKED` states mitigate rather than eliminate that risk.
- Discovery supports static literal and frozen product-ID template targets. Runtime-only targets not derivable from trusted source/fixtures remain unsupported by design.
- `AWAITING_TEST_REVIEW` is not `REPRODUCED`; human review, hash-bound acceptance, and frozen baseline confirmation belong to AR5.

Changed production/test files in this completion increment: `services/api/src/llm/client.ts`, `services/api/src/reproduction/targetDiscovery.ts`, `targetDiscovery.test.ts`, `definitionCompiler.ts`, `definitionCompiler.test.ts`, `candidatePolicy.ts`, `candidatePolicy.test.ts`, `generationProvider.ts`, `generationProvider.test.ts`, `generationProviderDiagnostics.test.ts`, and `generatedRunner.test.ts`. Recorded scripts, logs, run snapshots, and evidence are under `artifacts/arbitrary-reproduction/ar4-generation-execution/` and `artifacts/reproduction-runs/`.

Every documented AR4 acceptance criterion is satisfied. Recommended next task: **AR5 — human test review, hash-bound acceptance, and frozen baseline confirmation**.

### AR5 completion — hash-bound review and frozen baseline (2026-10-14)

Status: **COMPLETE**. Before this milestone, `AWAITING_TEST_REVIEW` was display-only: no review endpoint or controls existed, no accepted bytes were frozen, and no confirmation rerun could transition a generated candidate to `REPRODUCED`.

Implemented changes:

- Added a review service and `POST /api/reproduction-runs/:runId/review` endpoint. Approval requires the exact 64-character definition and compiled-test hashes, a reviewer identity, the current report identity, and the unchanged target-source fingerprint.
- Approval revalidates the compiler-owned source bytes, copies them once into `artifacts/reproduction-runs/accepted/<runId>/`, creates the trusted Playwright config, persists `CONFIRMING_BASELINE`, and reruns those frozen bytes through the real evidence runner.
- Only a structured `ASSERTION_FAILED` confirmation on unchanged source reaches `REPRODUCED`. Passing baselines, infrastructure failures, source changes, report revisions, byte tampering, stale hashes, and approval replay fail closed.
- Rejection is retained with reviewer notes and requires a new generation run and fresh review; it does not create an accepted candidate or baseline.
- A successful confirmation promotes the frozen test and its explicit containment root to the case, records the verified baseline, and enables the existing reproduced-case workflow.
- Added dashboard controls displaying both candidate hashes, optional reviewer notes, `Approve & Confirm Baseline`, and `Reject Candidate` actions.

Verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Review service contract before implementation | Expected failure: module absent, 0 tests collected | [`pre-implementation-review-service.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/pre-implementation-review-service.log) |
| Review service and API integration | PASS: 2 files, 16 tests | [`api-integration-first.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/api-integration-first.log) |
| Combined first UI/API run | 2 files/21 tests passed; one API worker exited with Windows code `3221226505` during startup | [`focused-review-ui.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/focused-review-ui.log) |
| Affected route isolated retry | PASS: 1 file, 10 tests | [`routes-retry.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/routes-retry.log) |
| Final review service/routes/dashboard suite | PASS: 3 files, 26 tests | [`focused-final.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/focused-final.log) |
| Full API regression | PASS: 53 files, 275 tests | [`api-regression.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/api-regression.log) |
| Dashboard regression | PASS: 6 files, 17 tests | [`dashboard-regression.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/dashboard-regression.log) |
| Full typecheck | Initial unused-test-symbol and dashboard ES-lib issues were corrected; final PASS for API, dashboard, and MiniShop | [`typecheck-first.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/typecheck-first.log), [`typecheck-retry.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/typecheck-retry.log), [`typecheck-final.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/typecheck-final.log) |
| Production builds | PASS: dashboard and MiniShop | [`build.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/build.log) |
| `git diff --check` | PASS; line-ending warnings only | Executed after the live acceptance audit |

Live acceptance approved AR4 calculation run `8dca2a60-8416-40e4-a4e6-e7de42948cf4`. The endpoint verified definition hash `19604a7965f6ecb5027b25e6b1eba557990bd0a490ed22d20b2b9f9ceebe8aff`, compiled hash `4c571551e174c161da1f2093ac138eda138b4f4e512bd3ff54b7d23d378431f9`, and unchanged source fingerprint `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`. The frozen file's independently computed SHA-256 equals the reviewed compiled hash. Chromium returned `ASSERTION_FAILED`, the durable reproduction run and case both reached `REPRODUCED`, and the confirmed test fingerprint is `48f3565ee820b974f24a16c4d15a3550ef2d613e3d152df5832c93370194fd10`. Evidence: [`live-review-result.json`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/live-review-result.json), [`live-api.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/live-api.log), [`live-minishop.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/live-minishop.log), and the accepted artifact directory [`accepted/8dca2a60-8416-40e4-a4e6-e7de42948cf4/`](../../artifacts/reproduction-runs/accepted/8dca2a60-8416-40e4-a4e6-e7de42948cf4/).

Changed AR5 files: `packages/shared-types/src/index.ts`, `services/api/src/reproduction/contracts.ts`, `services/api/src/reproduction/reproductionReviewService.ts`, `services/api/src/reproduction/reproductionReviewService.test.ts`, `services/api/src/routes/reproductionRuns.ts`, `services/api/src/routes/reproductionRuns.test.ts`, `services/api/src/routes/reproduce.ts`, `apps/dashboard/src/types/reproduction.ts`, `apps/dashboard/src/api/client.ts`, and `apps/dashboard/src/components/CaseDetail.tsx` plus its test.

Every AR5 acceptance criterion is satisfied: accepted bytes cannot be swapped, and any report/source/review revision requires a fresh reviewed run and baseline. Recommended next task: **AR6 — pass the accepted test and containment identity through dynamic repair, preserve the identical test after patch, and extend proof bundles with reproduction provenance**.

### AR6 completion — accepted-test repair and proof integration (2026-10-14)

Status: **COMPLETE**. Repair runs now treat a reviewed generated test as a first-class immutable input rather than assuming every reproduction lives under the configured benchmark-spec directory.

Implemented changes:

- Added an explicit accepted-test containment root and immutable generation provenance to case reproduction data, repair-run inputs, durable repair records, graph state, baseline/post-patch runner calls, verification gates, and proof manifests.
- Repair-run creation computes compiler-owned fingerprints for accepted tests, captures their exact bytes and AR4/AR5 provenance, and rejects missing or mutated inputs.
- Baseline, pre-apply, post-patch, and final verification gates all compute the correct accepted-test fingerprint. Both browser phases receive the same containment root; configured benchmark tests remain compatible.
- Proof bundles include the originating reproduction run, definition hash, compiled-test hash, source fingerprint, reviewer, and acceptance time alongside the repair proposal/review and before/after evidence.
- Added [`scripts/verify-arbitrary-report-to-proof.ts`](../../scripts/verify-arbitrary-report-to-proof.ts), a deterministic reference verifier for the accepted calculation report. It patches only the isolated repair workspace and independently extracts the resulting ZIP.

Focused and regression evidence:

| Command | Outcome | Evidence |
| --- | --- | --- |
| Repair graph/service/verification/proof compatibility | PASS: 4 files, 33 tests | [`ar6-compatibility-first.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-compatibility-first.log) |
| Accepted input capture | PASS: 1 file, 8 tests | [`ar6-accepted-input-focused.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-accepted-input-focused.log) |
| Initial identical-test lifecycle | Expected focused failure exposed a missing containment root at the pre-apply baseline gate; after correction, an identity-fixture mismatch was also retained | [`ar6-identical-test-cycle.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-identical-test-cycle.log), [`ar6-identical-test-cycle-retry.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-identical-test-cycle-retry.log) |
| Final accepted-test repair lifecycle | PASS: 1 file, 9 tests | [`ar6-identical-test-cycle-final.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-identical-test-cycle-final.log) |
| Proof provenance and verification gates | PASS: 2 files, 21 tests | [`ar6-proof-provenance-focused.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-proof-provenance-focused.log) |
| Full typecheck | PASS: API, dashboard, MiniShop | [`ar6-typecheck.log`](../../artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/ar6-typecheck.log) |
| First full API regression | 52 files passed; one newly extended route fixture failed because its mocked accepted candidate lacked a source fingerprint. The production path had supplied it; the fixture was corrected and rerun. | [`api-regression.log`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/api-regression.log) |
| Affected route retry | PASS: 1 file, 10 tests | [`routes-regression-retry.log`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/routes-regression-retry.log) |
| Final full API regression | PASS: 53 files, 277 tests | [`api-regression-final.log`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/api-regression-final.log) |
| Production build | PASS: dashboard and MiniShop | [`build.log`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/build.log) |

End-to-end reference run `run-43ebe23d-fcf4-4f26-9494-4a2cb913427b` used the AR5 accepted test and a deterministic reviewed proposal in an isolated workspace. The real browser baseline was `ASSERTION_FAILED`; the post-patch run was `PASSED`; both fingerprints were exactly `48f3565ee820b974f24a16c4d15a3550ef2d613e3d152df5832c93370194fd10`. Typecheck, build, and unit-test checks passed. The proof manifest verified, independently extracted 25 entries, and retained the originating reproduction run and hashes. Evidence: [`reference-result.json`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/reference-result.json), [`reference-run.log`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/reference-run.log), and [`proof bundle`](../../artifacts/arbitrary-reproduction/ar6-repair-proof/proof-bundle-case-1791917776888-hvza72c3-run-43ebe23d-fcf4-4f26-9494-4a2cb913427b.zip).

The MiniShop source fingerprint after verification remained `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`; the configured source was unchanged. The reference proposal is explicitly simulated; browser execution, isolated patch application, all verification gates, regressions, and the proof bundle are real. A live-model repair request was not executed because transmitting report/source content to the external provider requires explicit user authorization.

Every AR6 acceptance criterion is satisfied. Recommended next task: **AR7 — held-out evaluation, demo packaging, accurate README/status/architecture claims, and portfolio-ready metrics**.

### AR7 progress — evaluation and release packaging (2026-10-14)

Status: **COMPLETE**. The release package is locally verified and the frozen held-out arbitrary-report split was executed once without post-freeze prompt tuning. Live-model arbitrary-source repair remains outside the claim boundary because only report transmission—not source transmission—was authorized.

Executed changes:

- Added `data/evals/arbitrary-reproduction-release.json`, frozen on 2026-10-14 with two complete development reports and four complete held-out reports covering calculation, state, deletion, async, rendering, and multi-file behavior. Its canonical dataset hash is `d180534a4320c993283ffa07e4350ef20431eda137c1361f50ea4316591feba3`; both evaluation commands verify it before use. It explicitly forbids relabeling historical AR4 evidence as prospective held-out results.
- Added `scripts/report-ar7-evaluation.ts` and `npm run arbitrary:evaluate`. The report retains separate denominators for the initial AR4 cohort, the later discovery-bound acceptance cohort, AR5 human review, and the AR6 deterministic reference repair.
- Added `scripts/run-arbitrary-heldout-evaluation.ts` and `npm run arbitrary:evaluate:live -- --confirm-live`. The runner defaults to held-out cases, verifies the frozen hash and policy, retains every terminal result, and refuses to contact a provider without the explicit live flag.
- Updated the root README with the implemented arbitrary-report lifecycle, current commands, and accurate claim boundary.
- Added a dynamic demo storyboard and portfolio release notes with a resume bullet, LinkedIn draft, measured results, and disclosure of the deterministic repair proposal.
- Added `npm run arbitrary:verify` for the real-browser, same-test, proof-bearing local reference workflow.
- Added `scripts/check-dynamic-demo-readiness.ts` and `npm run demo:check`. The audit independently reads the saved case and generation review, hashes the accepted test bytes, extracts the proof ZIP, checks provenance and identical test identity, verifies all required checks, and confirms the scorecard/demo/portfolio artifacts.

Recorded metrics:

- Initial historical live cohort: usable provider response 3/8 (37.5%), valid candidate 4/9 provider outputs (44.4%), executable candidate 4/9 (44.4%), relevant reproduction 0/8 runs, infrastructure error 0/8, unsupported 0/8. Provider usage/cost was unavailable; per-attempt durations remain in run evidence.
- Final discovery-bound cohort: complete reports 3/3, valid candidates 3/3, executable candidates 3/3, relevant assertion failures 2/3, passing baseline 1/3, and source identity unchanged.
- Human acceptance: 1/2 review-eligible assertion failures completed hash-bound approval and unchanged-source confirmation.
- End-to-end reference: 1/1 verified with baseline `ASSERTION_FAILED`, post-patch `PASSED`, identical fingerprint, all required checks passing, and verified proof manifest. This is not reported as live-model repair accuracy.

Verification:

| Command | Outcome | Evidence |
| --- | --- | --- |
| `npm run arbitrary:evaluate` | Initial expected failure on a retained UTF-8 BOM; parser corrected without modifying evidence, then PASS | [`evaluation-report.json`](../../artifacts/arbitrary-reproduction/ar7-evaluation/evaluation-report.json), [`evaluation-report.md`](../../artifacts/arbitrary-reproduction/ar7-evaluation/evaluation-report.md) |
| `npm run arbitrary:evaluate:live` without confirmation | Expected safety refusal before network activity: `Live provider evaluation requires --confirm-live` | Executed after runner creation |
| First held-out launch after authorization | Environment-only startup failure: readiness probed MiniShop at `127.0.0.1` while Vite was available at `localhost`; no report was transmitted | [`heldout-api.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/heldout-api.log), [`heldout-minishop.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/heldout-minishop.log) |
| Frozen held-out launch with `--confirm-live` | Executed once: 4 reports; 2 valid candidates, 1 executable passing baseline, 0 relevant reproductions, 2 provider-connectivity infrastructure failures, 0 unsupported | [`aggregate.json`](../../artifacts/arbitrary-reproduction/ar7-evaluation/live-held-out-2026-10-14T19-38-49-231Z/aggregate.json), [`heldout-live-run.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/heldout-live-run.log) |
| `fillTarget` focused pre-implementation contract | Expected failure: action unsupported; unrelated sandbox temp errors retained separately | [`fill-target-preimplementation.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/fill-target-preimplementation.log) |
| `fillTarget` schema/compiler/policy/prompt | PASS: 3 files, 20 tests | [`fill-target-focused.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/fill-target-focused.log) |
| `fillTarget` real evidence runner | PASS: 4 files, 26 tests, including real browser input by discovered test ID | [`fill-target-real-runner.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/fill-target-real-runner.log) |
| First full post-held-out unit regression | 60/61 files passed; one Windows Vitest worker exited with code `3221226505` before executing `cases.test.ts`; isolated retry passed 16/16 | [`unit-regression-post-heldout.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/unit-regression-post-heldout.log), [`cases-regression-post-heldout.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/cases-regression-post-heldout.log) |
| Final full unit regression with two workers | PASS: 61 files, 301 tests | [`unit-regression-post-heldout-final.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/unit-regression-post-heldout-final.log) |
| Post-held-out typecheck and production build | PASS: API, dashboard, MiniShop typecheck; dashboard and MiniShop builds | [`typecheck-post-heldout.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/typecheck-post-heldout.log), [`build-post-heldout.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/build-post-heldout.log) |
| Focused API/reproduction/repair/proof/dashboard run in restricted sandbox | Environment-only failures: sandbox temp-file `ENOENT`/`EPERM` and loopback `EACCES`; no product conclusion drawn | [`focused-regression.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/focused-regression.log), [`focused-regression-retry.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/focused-regression-retry.log) |
| Same focused suite with workspace temp and loopback permission | PASS: 16 files, 103 tests | [`focused-regression-final.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/focused-regression-final.log) |
| `npm run test:unit` | PASS: 61 files, 298 tests | [`unit-regression.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/unit-regression.log) |
| `npm run typecheck` | PASS: API, dashboard, MiniShop | [`typecheck.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/typecheck.log) |
| `npm run demo:check` | PASS: 16/16 release-chain checks; recorded local dynamic demo is ready within the documented MiniShop/deterministic-proposal boundary | [`demo-readiness.json`](../../artifacts/arbitrary-reproduction/ar7-evaluation/demo-readiness.json), [`demo-readiness-complete.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/demo-readiness-complete.log) |
| Typecheck after held-out runner and readiness audit | PASS: API, dashboard, MiniShop | [`typecheck-demo-readiness.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/typecheck-demo-readiness.log) |
| `npm run build` | PASS: dashboard and MiniShop | [`build.log`](../../artifacts/arbitrary-reproduction/ar7-evaluation/build.log) |
| MiniShop source manifest | Unchanged: `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289` | Recomputed after regressions |
| `git diff --check` | PASS; line-ending warnings only | Executed after release edits |

Changed AR7 files: `data/evals/arbitrary-reproduction-release.json`, `scripts/report-ar7-evaluation.ts`, `scripts/run-arbitrary-heldout-evaluation.ts`, `scripts/reconcile-arbitrary-heldout-evaluation.ts`, `scripts/check-dynamic-demo-readiness.ts`, `services/api/src/reproduction/definitionCompiler.ts` and test, `candidatePolicy.ts` and test, `generationProvider.ts` and test, `generatedRunner.test.ts`, `package.json`, `README.md`, `docs/README.md`, `docs/dynamic-demo-script.md`, `docs/portfolio-release.md`, and this tracker. Generated evidence is under `artifacts/arbitrary-reproduction/ar7-evaluation/`.

Unresolved assumptions and risks:

- The held-out split was consumed by its single recorded execution. It must not be rerun or reused as a fresh held-out score after the post-evaluation `fillTarget` correction.
- Live provider availability, response conformance, latency, token usage, and cost remain externally variable.
- A live-model repair would transmit the bug report and relevant MiniShop source snippets to the configured external provider. That action was not authorized, so the recorded AR6 repair proposal remains deterministic reference output.

Every documented AR7 acceptance criterion is satisfied: the split was frozen before execution, independent tests/reference fixes stayed outside model context, required defect categories are represented across the evaluation datasets, all denominators and failures are retained, and README/demo/status/portfolio claims match the evidence. AR7 is **COMPLETE**. Recommended next task: record the packaged local demo. A future model-quality evaluation must use a newly frozen, unseen cohort; live-model arbitrary-source repair remains optional and requires separate source-transmission authorization.

## Progress update rules

- Mark a task complete only after its acceptance check runs.
- Link the exact artifact directory and command result.
- Record infrastructure errors separately from product failures.
- Repeat the relevant baseline whenever a test or definition changes.
- Never count simulated output as live-model accuracy.
- Never count selector, setup, timeout, or target-start errors as reproduced bugs.

## Latest evidence

- Dashboard unit tests: 5 passed, 0 failed (`artifacts/ui-improvements-unit.json`).
- Dashboard browser checks: 2 passed (`artifacts/ui-redesign/f1179c19-a3b3-46bc-be9a-4c8e6ccc3b88/`).
- These validate the UI and report payload only; they do not validate automatic reproduction.
