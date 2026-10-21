# Reliability hardening and prospective evaluation plan

## Objective and claim boundary

Make the local MiniShop report-to-proof workflow dependable enough to diagnose failures, reproduce report-matched bugs, and support a defensible portfolio demonstration. This plan does not extend the system to arbitrary websites. The 2026-10-14 four-case held-out cohort is consumed and remains historical evidence: **2/4 valid candidates, 1/4 executable candidate, 0/4 relevant reproductions, and 2/4 provider connectivity failures**. The later `fillTarget` change cannot be credited to that cohort.

The work is complete only when a new, unseen cohort has been run once with retained per-case evidence; its failures remain in the denominator; and public claims match the recorded results. No deployment or merge is part of this plan.

## 0. Establish a reproducible starting point

1. Inventory the current working tree and record a source commit or patch fingerprint without discarding the existing changes. Review the historical scorecard and raw run artifacts. Treat missing ignored artifacts as missing evidence, not as successful runs.
2. Confirm the exact MiniShop target, browser revision, configured generation provider/model, timeout, and source fingerprint. Use a local provider unless external transmission of report/source data has already been authorized. Never put keys or source text in diagnostic logs.
3. Run the existing unit, typecheck, build, and real-browser workflow gates. Record command, timestamp, exit code, and log path. Distinguish environment failures from application failures.
4. On the development cases only, reproduce at least one provider failure and one selector/action failure with focused tests **before** changing their implementation. Preserve the failing baseline. If a test is changed later, repeat that baseline.

**Exit gate:** baseline evidence and a failure taxonomy exist; no new held-out cases have been inspected by generation or used for tuning.

## 1. Make provider failures diagnosable and recoverable

**Likely code:** `services/api/src/llm/client.ts`, `services/api/src/ai/providers.ts`, `services/api/src/reproduction/generationProvider.ts`, `services/api/src/reproduction/reproductionService.ts`, run contracts/store, and focused tests.

1. Use one structured generation result/error contract for legacy, OpenAI, and Ollama adapters. Record provider/model, attempt count, elapsed time, bounded response shape, HTTP status when available, timeout versus user cancellation, and a stable failure code. Redact credentials and raw provider bodies from normal status responses. Preserve existing size-capped raw output only in controlled evidence artifacts.
2. Add a fast preflight for configuration and provider reachability/model availability before starting a batch. A failed preflight blocks the batch with a clear reason; it does not turn every case into an invalid candidate.
3. Retry only transient transport failures, 429, and 5xx, with bounded exponential backoff, jitter, `Retry-After` where present, and one overall deadline. Never retry missing credentials, 4xx validation/auth errors, explicit cancellation, or a malformed candidate as a transport error. Count and retain every request attempt. Keep any provider retry budget separate from candidate regeneration attempts.
4. Ensure timeout/cancellation signals reach the HTTP call and retry delay. Persist a terminal `BLOCKED` or `CANCELLED` state promptly, including on process restart or an abandoned run, so the UI and evaluator cannot wait indefinitely. A restart recovery action must retain the prior attempt trail and must not silently launch a fresh model call.
5. Surface the actionable reason and safe retry choice in the UI. Keep the distinction between provider outage, invalid generated definition, target outage, browser failure, and report-relevant assertion failure.

**Verification:** fault-injection tests for DNS/refused connection, timeout, 429 with/without `Retry-After`, 5xx, 401, malformed/empty success, cancellation during call/backoff, and process interruption. Verify bounded time and retry counts, secret redaction, durable terminal state, and correct UI classification. Run these tests against the original code first where they reproduce a reported problem, then rerun unchanged after the fix.

**Exit gate:** no tested provider or infrastructure failure is reported as a reproduced bug or merely an invalid candidate; all tested runs reach an honest terminal state within the configured deadline.

## 2. Improve candidate execution using observed failures

**Likely code:** target discovery, candidate policy, definition compiler, evidence runner, and their focused tests.

1. Use the existing held-out locator failure only as a development regression case. Confirm that compiler 1.1.0's `fillTarget` actually passes a real-browser test; do not rescore the consumed cohort.
2. For each *new* development failure, first record the failing browser trace and classify it as: wrong target/action, unsupported report detail, timing/setup, provider output, or true assertion mismatch. Fix the narrowest cause. Prefer discovered, exact target IDs or accessible roles/names; reject ambiguous or absent targets instead of guessing.
3. Verify asynchronous and navigation actions with bounded waits and fresh locator resolution. Keep assertions tied to the report's expected behavior, and retain the compiler/policy boundary that prohibits executable model code or invented selectors.
4. Run the same focused reproduction test after the change, followed by the relevant unit, API, browser, and proof-integrity checks. Confirm source fingerprints and test hashes are unchanged across the baseline/post-patch pair where a repair is claimed.

**Exit gate:** every fixed development failure has before/after evidence, and selector/setup failures cannot be counted as report-relevant reproductions.

## 3. Build a genuinely new held-out evaluation

**Likely files:** a new versioned dataset under `data/evals/`, a configurable replacement for `scripts/run-arbitrary-heldout-evaluation.ts`, scoring/reconciliation scripts, and a new evidence report. Leave the 2026-10-14 dataset and AR7 scorecard intact.

1. Construct separate development and held-out cohorts from the local MiniShop only. Aim for **12 answerable held-out bug reports plus at least 2 non-bug/unsupported controls** across calculation, state/deletion, async, rendering/navigation, and multi-file behavior. Include complete steps, expected, and actual fields. Use independently prepared, isolated MiniShop defect variants where needed so each answerable report describes a verified, present bug. Do not let the generation path see reference tests, fixes, or labels.
2. Independently verify each answerable case with a focused reference browser reproduction before freezing it. Record the variant/source fingerprint, reference test hash, expected outcome, and reviewer decision. Exclude ambiguous cases before freeze; never remove a difficult case after observing model output.
3. Freeze the cohort manifest with schema version, SHA-256 hash, case IDs, labels, MiniShop variant hashes, scoring rubric, provider configuration, prompt/compiler versions, retry budgets, and preset stop conditions. Keep a separate development split for tuning. The new held-out split is used once for the prospective result.
4. Refactor the runner to take an explicit versioned dataset path and output directory. Preflight the browser, target variants, provider, and disk access. Write an append-only per-case result as each case finishes; a timeout or API error becomes a retained case outcome and the batch continues. On resume, reject changed dataset/config fingerprints and never rerun completed case IDs into the same scorecard.
5. Score stages separately: provider response, valid definition, executable browser test, **reviewed report-matched failing assertion**, accepted frozen baseline, verified repair with identical test, infrastructure error, unsupported/control outcome, latency, and usage/cost when available. `AWAITING_TEST_REVIEW` alone is *not* a relevant reproduction. A reviewer must compare the assertion and trace with the frozen report; a bare Playwright failure is insufficient. Publish each count with its denominator and case IDs. Unknown usage stays unknown.
6. Produce a machine-readable manifest and sanitized report from the immutable per-case records. Reconciliation may recalculate metrics, but must not overwrite original run records or silently select the newest directory. State the small-sample limit explicitly and report all failures.

**Predeclared release targets (targets, not current results):** complete evidence for every held-out case (14/14 if the minimum cohort is used); zero false reproduced/verified labels; no unclassified infrastructure failure; at least 10/12 valid candidates, 9/12 executable candidates, and 8/12 reviewer-confirmed report-matched reproductions among the 12 answerable bug cases. Report non-bug controls separately and retain every control and infrastructure outcome in full-cohort totals. If any target is missed, publish the observed score and failure analysis; do not change the cohort or threshold after seeing results. A larger later cohort is needed before broad reliability claims.

**Exit gate:** one prospective run is complete, every case is accounted for, dataset/source/config hashes verify, and independent review of assertion relevance is recorded. The evaluation is not complete if provider access or browser setup is unavailable; that condition is reported as blocked rather than a model-quality score.

## 4. Align the app, docs, and demo with the evidence

**Likely files:** `docs/current-project-status.md`, `docs/portfolio-release.md`, `docs/evidence/`, `docs/rag-interview-guide.md`, `README.md`, and demo-readiness checks.

1. Update the public scorecard from the new frozen artifacts, preserving the earlier AR7 results as historical. Explicitly separate live model generation from deterministic reference repair. Keep MiniShop as the scope boundary.
2. Update the interview guide's retrieval section to distinguish the lexical BM25 plus hashed-token baseline from learned embeddings. If local Ollama retrieval measurements are cited, give their provider/model, 12-query development-set size, strategy, and limitations; do not present them as held-out reproduction evidence. Prefer the configuration actually used for the demo.
3. Make the demo show one successful report-to-proof path and one honest provider/candidate failure path, including the reason, evidence link, and safe retry action. Ensure UI labels do not equate an unreviewed assertion failure with a verified reproduction.
4. Run `npm run test:unit`, `npm run typecheck`, `npm run build`, `npm run test:playwright`/the evidence runner, and `npm run demo:check`. Check both Windows and Linux CI where available. Record failures and environment limitations; do not rewrite historical logs or claim hosted CI execution from local tests.

**Exit gate:** every quantitative claim has a matching artifact and denominator; the demo's status language matches the run states; the documented verification commands have recorded outcomes.

## Order and decision points

1. Baseline and failure reproduction.
2. Provider fault handling and tests.
3. Browser candidate fixes driven by development evidence.
4. Freeze the new dataset and rubric **after** the code and evaluation harness are stable.
5. Run the new held-out split once; review and score without prompt/code tuning against it.
6. Update docs and demo from the retained results.

If a live external provider would receive MiniShop source or report content, obtain explicit authorization for that transmission before that run. The local Ollama path can be evaluated without that external transfer. No deployment or automatic merge is authorized.
