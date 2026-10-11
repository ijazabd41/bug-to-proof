# Bug-to-Proof Comprehensive System Test and Audit Report

> **POINT-IN-TIME REPORT:** Results apply to the source identity and date below. They do not establish arbitrary report-to-test generation or the current dirty working tree. See [current status](current-project-status.md).

**Date:** 2026-10-09  
**Tested Source Identity (Commit):** `30f4237a15eeded52280e958178115fc9da83478` (Hardened Correctness Release)  
**Runtime Environment:** Node `v24.15.0`, npm `11.12.1`, OS: Windows 11 (`win32 x64`)  
**Evidence Directories:**
- System Audit Matrix: [`artifacts/system-testing/audit-2026-10-09-0320/`](../artifacts/system-testing/audit-2026-10-09-0320/)
- Real Browser Failure-to-Pass Workflow: [`artifacts/system-testing/real-browser-verification/`](../artifacts/system-testing/real-browser-verification/)
- Live Model Benchmark Evaluation: [`artifacts/system-testing/live-model-eval-2026-10-09/`](../artifacts/system-testing/live-model-eval-2026-10-09/)

---

## 1. Executive Summary

A comprehensive, evidence-backed audit and correctness validation of **Bug-to-Proof** was conducted across the monorepo workspace at `D:\bug-to-proof`. Following the latest review probe identifying test identity mismatches and saved disk evidence validation gaps, the dynamic repair engine, LangGraph orchestrator, verification gates, runtime resource registry, and checkpoint recovery were hardened to enforce strict fail-closed evidence integrity.

### High-Level Status
- **Audit Matrix Scenarios:** 25 / 25 PASS (100% of defined audit checks passed, 0 failed, 0 blocked).
- **Monorepo Typecheck:** PASS (0 errors across `services/api`, `apps/dashboard`, `apps/minishop`, `packages/shared-types`).
- **Monorepo Unit & Lifecycle Tests:** PASS (30 test suites, 112 / 112 unit, lifecycle, and integration tests passed, 100%).
- **Monorepo Production Builds:** PASS (Dashboard: `203.59 kB`, MiniShop: `172.29 kB` built with Vite).
- **Real Browser Failure-to-Pass Workflow:** PASS (Playwright Chromium baseline assertion failure -> patch application -> browser pass -> candidate regression suite -> gate graduation).
- **Live Model Dynamic Repair Evaluation:** 4 / 5 cases verified end-to-end with genuine LLM-generated patches (`openai/gpt-oss-20b` via Groq) without providing reference fixes (saved review: `artifacts/system-testing/review-live-2026-10-09/saved-run-review.json`).
- **Cancellation & Process Cleanup:** Verified with controlled fixtures; model generation and Playwright executions abort cleanly, child processes are terminated, and `CANCELLED` remains terminal.
- **Durable Process Restart & Checkpoint Deserialization:** Verified with real Vite apps and independent OS processes; handles are excluded from checkpoints and re-established safely on resume.
- **Binary Invariant Idempotent Application:** Enforces binary match against pristine original snapshot or expected post-patch snapshot, rejecting partial or mutated workspace states.

---

## 2. Categorization of System Evidence

To maintain strict evidence integrity, Bug-to-Proof categorizes all verification evidence into distinct operational tiers:

| Evidence Category | Execution Mechanism | Invariants & Guarantees | Key Verification Artifacts |
| :--- | :--- | :--- | :--- |
| **Static Inspection** | Code analysis & AST checks | Validates source containment, absence of solution leaks, schema validation, and config parameters. | `INV-01`, `EVAL-02` |
| **Simulated Contracts** | In-memory synthetic runners | Validates LangGraph state machine transitions, retry loops, and fail-closed gates without live dependencies. | `GRAPH-01`, `GRAPH-02`, `GRAPH-03` |
| **Fresh-Instance Reload** | Separate class instantiation in memory | Validates checkpointer serialization/deserialization and pending write tuples without shared references. | `fileCheckpointer.test.ts` |
| **Actual Process Restart** | Independent OS subprocesses (`spawnSync`) | Process A creates disk checkpoint and terminates; Process B in separate OS process reloads and resumes exact proposal; validates double-apply protection. | `GRAPH-04`, `scripts/helpers/twoproc-runner.ts` |
| **Browser Smoke** | Live Chromium via Playwright | Real browser navigation, case detail observation, failure/404 presentation, full-page screenshot capture. | `DASH-01`, `dashboard-audit-screenshot.png` |
| **Real Browser Workflow** | Live Playwright + ephemeral Vite app | End-to-end failure-to-pass workflow: real baseline failure -> exact approval -> candidate patch -> real browser pass -> 3 candidate regression checks -> gate verification. | `browser-workflow-result.json` |
| **Live Model Repair** | Live OpenAI-compatible LLM (Groq) | Genuine model generation from bug report prose & source context without reference solutions; 4/5 cases verified. | `live-model-evaluation-results.json` |

---

## 3. Correctness & Evidence Integrity Fixes

The following 5 major correctness areas were implemented, hardened, and verified:

### 1. Complete Cancellation Propagation (`playwrightRunner.ts`, `verification.ts`, `client.ts`, `repairGraph.ts`)
- **Problem:** `registerChildProcess` previously had no callers. Runner subprocesses and long-running model calls did not listen to run cancellation signals, potentially leaving orphaned processes or accepting state mutations post-cancellation.
- **Fix:** 
  - Subprocesses spawned by `playwrightRunner.ts` and `verification.ts` (`runRequiredChecks`) now register themselves with `registerChildProcess(runId, child)` and unregister upon completion.
  - The run's `AbortSignal` is passed explicitly into LLM calls (`callLLM`, `generateAnswer`, `generateProposal`), runner operations, and regression checks.
  - On cancellation or timeout, process trees are forcefully terminated via `terminateProcessTree` (`taskkill /T /F` on Windows), active locks are released, and `CANCELLED` is enforced as terminal, preventing subsequent patch application or verification.
- **Verification:** Unit and integration tests in `lifecycle.test.ts` verify model call cancellation and runner abort with child process cleanup and invariant terminal status.

### 2. Removal of Live Handles from Checkpoints & Process Restart Recovery (`workspace.ts`, `repairGraph.ts`, `runtimeRegistry.ts`)
- **Problem:** `RunWorkspace` previously carried `appProcess` (`ChildProcess`) directly in LangGraph state, risking serialization failures during checkpoint persistence and stale handle reuse across restarts.
- **Fix:**
  - Decoupled all child process handles and controllers from serialized state; they are stored strictly in `runtimeRegistry.ts`.
  - Checkpointed state preserves only serializable workspace identities, paths, source manifests, and fingerprints.
  - Upon graph resume across process restarts, `repairGraph.ts` verifies HTTP reachability and safely re-spawns the isolated Vite server on-demand if inactive.
- **Verification:** Dedicated test in `lifecycle.test.ts` verifies real Vite app startup, checkpoint persistence without handles, server termination, and successful re-establishment upon graph resume.

### 3. Strengthened Idempotent Application & Binary Acceptance Invariant (`patchPolicy.ts`, `repairGraph.ts`)
- **Problem:** `areEditsAlreadyApplied` previously risked skipping original snapshot validation if replacement snippets were partially present.
- **Fix:**
  - Implemented `computeExpectedPatchedFingerprint(minishopDir, edits)`, computing the complete expected post-patch source manifest from the pristine snapshot and approved edits.
  - Resumption strictly enforces a binary invariant: the workspace must match either (a) the complete original pristine snapshot (ready for transactional application), or (b) the complete expected patched snapshot (already applied).
  - Any partial application, ambiguous state, or unrelated file mutations are immediately rejected with descriptive errors.
- **Verification:** Verified in `lifecycle.test.ts` by simulating application interruption and attempting mutations before resume.

### 4. Complete Centralized Evidence Binding & Baseline Gate (`verification.ts`, `repairGraph.ts`)
- **Problem:** Verification previously checked report hashes without validating saved disk artifacts, and baseline gates were only validated at finalization rather than prior to patch application.
- **Fix:**
  - Enforced `validateBaselineGates` in `applyApprovedPatchNode` prior to applying patches, and comprehensive `validateVerificationGates` prior to graduation to `VERIFIED`.
  - In dynamic mode, requires trusted run-specific artifact directories, loads `manifest.json` and `result.json`, recomputes SHA-256 digests, reclassifies report outcomes, and matches test fingerprints and reporter-format identities (`${specFile}:${title}:${project}`).
  - Validates candidate regression check logs on disk and candidate source invariance before and after check execution.
- **Verification:** Negative test suite in `verification.test.ts` asserts rejection for swapped reports, wrong run IDs, altered test identities, missing check logs, and candidate mismatches.

### 5. Non-Destructive Evaluation Storage & Full Denominator Reporting (`evaluate-repair.ts`)
- **Problem:** Benchmark evaluation runs previously overwrote user cases in `data/cases/` and omitted explicit denominators in summary statistics.
- **Fix:**
  - Implemented automatic backup and restoration of existing user cases during evaluation runs.
  - Formatted evaluation summary output and JSON reports to include explicit denominators (`x / n`) for all metrics, unique `runId`, artifact directory links, dataset SHA-256 hash, attempt counts, failure reasons, and token usage/cost fields (marked "unknown" when unavailable).
  - Explicitly separated simulated fixture harnesses from live execution.
- **Verification:** Verified with `npm run repair:evaluate -- --simulated` and static audit check `EVAL-02`.

---

## 4. Requirement and Acceptance Test Matrix

The full matrix below reflects the 25 automated & contract checks executed by [`scripts/audit-system.ts`](../scripts/audit-system.ts) (25/25 PASS):

| Sec | Test ID | Requirement | Scenario | Expected | Actual | Evidence Type | Status |
| :--: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | `INV-01-WORKSPACE-INVENTORY` | Monorepo packages & runtime identified | Inspect Node, OS, package hierarchy, and LLM configuration | All packages exist, Node >= 18 | Node v24.15.0, win32 x64, 4 packages valid, LLM config parsed | `STATIC` | **PASS** |
| **3** | `API-01-CASE-STORE-LIST-READ` | Case store lists cases & fetches `case-001` | Read cases array and fetch `case-001` detail | Returns cases with valid reproduction fields | Listed 3 cases; case-001 title verified | `LIVE` | **PASS** |
| **3** | `API-02-CASE-NOT-FOUND` | Reading non-existent case returns null | Query unknown ID `non-existent-case-9999` | Returns `null` without throwing | Returned `null` gracefully | `LIVE` | **PASS** |
| **3** | `API-03-CASE-WRITE-DELETE-ISOLATION` | Disposable cases leave user cases intact | Create temporary case, verify, and delete | User `case-001` preserved; temporary case deleted | Created: `true`, Deleted: `true`, `case-001` preserved | `LIVE` | **PASS** |
| **4** | `RAG-01-TOOL-CONTAINMENT-TRAVERSAL` | Source tools restrict access to `src/` | List files and attempt `../../` and absolute paths | Excludes secrets/node_modules; blocks traversal | 12 files listed; traversal and absolute path blocked | `LIVE` | **PASS** |
| **4** | `RAG-02-RELEVANT-RETRIEVAL` | Relevant query retrieves accurate source lines | Query cart total calculation logic | Retrieves `cartStore.ts` / `Cart.tsx` with start/end lines | 4 relevant sources retrieved with line ranges | `LIVE` | **PASS** |
| **4** | `RAG-03-OFF-TOPIC-ABSTENTION` | Off-topic questions trigger abstention | Query unrelated general knowledge | Returns `abstained: true` or abstention answer | Abstained: `true`, sources: `0` | `LIVE` | **PASS** |
| **4** | `RAG-04-PROMPT-INJECTION-IMMUNITY` | Prompt injections cannot alter proof status | Query prompt injection requesting verification override | Treated purely as textual data; gates remain intact | Handled as text; no system state override | `LIVE` | **PASS** |
| **5** | `WS-01-SNAPSHOT-ISOLATION` | Isolated target snapshot excluding secrets | Create `RunWorkspace` and inspect manifest | Workspace, pristine copy, lock created without `.git`/`.env` | Manifest created (14 files); excludes `.git` and `.env` | `LIVE` | **PASS** |
| **5** | `WS-02-EPHEMERAL-APP-STARTUP` | MiniShop starts on ephemeral port with reachability | Launch Vite with positional root and verify HTTP response | Dynamically assigns port (>5000) and returns HTTP 200 | Port allocated; HTTP reachability `true` | `LIVE` | **PASS** |
| **5** | `WS-03-PRIMARY-CHECKOUT-IMMUTABILITY` | Candidate patch leaves primary checkout unchanged | Apply candidate mutation to isolated workspace | Primary repository source hash is completely unchanged | Isolated patched; Primary file unchanged | `LIVE` | **PASS** |
| **5** | `WS-04-PRISTINE-RESTORATION` | Pristine workspace restoration | Call `restoreOriginalWorkspace()` | Candidate workspace matches pristine copy | Reverted cleanly; mutated code removed | `LIVE` | **PASS** |
| **5** | `WS-05-PROCESS-TREE-TERMINATION` | Process tree terminates cleanly on Windows | Call `stopIsolatedMiniShop()` | Vite process terminated; port freed | Port freed within 500ms; lock released | `LIVE` | **PASS** |
| **6** | `GRAPH-01-PASSING-BASELINE-BLOCKED` | Passing baseline reproduction terminates as BLOCKED | Execute repair graph with baseline outcome `PASSED` | Transitions directly to `finalizeRun`, `state: BLOCKED` | State: `BLOCKED`; Proposal: `undefined` | `SIMULATED` | **PASS** |
| **6** | `GRAPH-02-EXACT-APPROVAL-RESUME-VERIFIED` | Checkpoint persistence & exact resume to `VERIFIED` | Interrupt at `AWAITING_REVIEW`, then resume with `Command` | Paused at review, saved checkpoint, resumed to `VERIFIED` | Paused: `AWAITING_REVIEW`; Checkpoint: `true`; Final: `VERIFIED` | `SIMULATED` | **PASS** |
| **6** | `GRAPH-03-TAMPERED-HASH-REJECTION` | Tampered proposal hash rejected on review | Submit review with mismatched SHA-256 hash | Throws exact approval binding failure | Tampered resume rejected with binding error | `SIMULATED` | **PASS** |
| **6** | `GRAPH-04-SEPARATE-PROCESS-CHECKPOINT-RELOAD` | Durable checkpoint reload across OS process boundary | Process A pauses at review and exits; Process B in separate OS process loads checkpoint and resumes | Resumes exact proposal to `VERIFIED` with double-apply protection | Process A exit: OK, Process B resume: VERIFIED, Idempotent resume: OK | `LIVE` | **PASS** |
| **7** | `POLICY-01-STALE-OLD-CONTENT-REJECTED` | Stale or non-matching `oldContent` rejected | Validate proposal with non-existent code string | Returns `valid: false` with descriptive error | Valid: `false`, Error: `oldContent not found` | `LIVE` | **PASS** |
| **7** | `POLICY-02-OUT-OF-SCOPE-REJECTED` | Edits outside `apps/minishop/src/` rejected | Validate proposal targeting `package.json` | Returns `valid: false` with scope violation error | Valid: `false`, Error: `Editing is not permitted` | `LIVE` | **PASS** |
| **8** | `GATE-01-CANDIDATE-REGRESSION-SUITE` | Required regression checks execute on target source | Run `runRequiredChecks()` on MiniShop source | 3 checks execute (`tsc`, `vite build`, `vitest`) and pass | 3 checks executed; All passed: `true` | `LIVE` | **PASS** |
| **8** | `GATE-02-DEFECTIVE-CANDIDATE-DETECTION` | Regression suite catches defective candidate | Run regression checks against deliberately broken candidate | Check fails with non-zero exit code | Check failed as expected; caught defective patch | `LIVE` | **PASS** |
| **8** | `GATE-03-VERIFICATION-GATES-TAMPER-REJECTION` | Central gate enforcer blocks tampered inputs | Test tampered hash, altered test fingerprint, mismatched test ID | Centrally throws verification failure | Tampered inputs rejected by central gate | `LIVE` | **PASS** |
| **9** | `DASH-01-DASHBOARD-NAVIGATION-AND-STATES` | Real Playwright browser navigation & states | Launch browser, navigate dashboard, observe case detail, 404 state, capture screenshot | Clean navigation, valid case view, clear 404 presentation | Real browser smoke test passed; screenshot captured | `LIVE` | **PASS** |
| **10** | `EVAL-01-BENCHMARK-DATASET-INTEGRITY` | Benchmark dataset contains 5 valid cases | Inspect `data/evals/repair-cases.json` | 5 distinct cases with existing reproduction test files | 5 distinct cases; all 5 Playwright spec files exist | `LIVE` | **PASS** |
| **11** | `EVAL-02-EVALUATOR-INTEGRITY` | Evaluator clearly labels modes & isolates solutions | Inspect evaluation runner and proposal generator | Simulated banner shown in fixture mode; solutions isolated | Mode labeled; metrics computed; solutions isolated | `STATIC` | **PASS** |

---

## 5. Live Model Benchmark Evaluation Results

Using the configured LLM provider (`openai/gpt-oss-20b` via Groq) without providing reference solutions, 5 benchmark defect cases were evaluated end-to-end:

| Case ID | Title | Split | Model Diagnosis | Candidate Patch Scope | Gate Outcome | All Checks |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: |
| `case-001-cart-total` | Cart total only reflects first item price | dev | Total selector returns first item price instead of sum | `src/store/cartStore.ts` | **VERIFIED** | PASS |
| `case-002-repeated-item-qty` | Adding existing item does not increment qty | held-out | `addItem` resets quantity to 1 instead of incrementing | `src/store/cartStore.ts` | **VERIFIED** | PASS |
| `case-003-item-removal` | Removing item retains item or clears cart | held-out | Item removal index filter logic defect | `src/store/cartStore.ts` | **BLOCKED** | N/A |
| `case-004-cart-clear` | Clear cart leaves items in state | held-out | `clearCart` slices array at index 1 instead of empty array | `src/store/cartStore.ts` | **VERIFIED** | PASS |
| `case-005-cart-total-quantities` | Cart total ignores item quantities | held-out | Total sums item prices without quantity multiplier | `src/store/cartStore.ts` | **VERIFIED** | PASS |

- **Live Model Pass Rate:** **80% (4 / 5 cases verified)** with genuine LLM-generated code.
- **Held-Out Generalization:** **75% (3 / 4 held-out cases verified)**.
- **Full Live Benchmark Artifact:** [`artifacts/system-testing/live-model-eval-2026-10-09/live-model-evaluation-results.json`](../artifacts/system-testing/live-model-eval-2026-10-09/live-model-evaluation-results.json)

---

## 6. Demo Readiness Assessment

The Bug-to-Proof system is **fully verified and demo-ready**:
1. **Evidence Integrity:** Gate graduation is mathematically bound to recorded before/after artifacts, SHA-256 report digests, spec basenames, and candidate regression logs.
2. **Crash & Restart Resilience:** Interrupted runs persist across process boundaries and resume cleanly with double-apply protection.
3. **Clean Isolation:** Candidate patches are executed exclusively within isolated ephemeral workspaces without mutating the primary checkout.
4. **Honest Reporting:** Simulated fixtures, real browser executions, and live LLM repairs are strictly delineated.
