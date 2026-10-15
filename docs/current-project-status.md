# Current Project Status: Bug-to-Proof

**Platform**: Windows x64 & Ubuntu Linux (Node.js >= 22.0.0)  
**Verification Date**: October 2026  
**Status**: Arbitrary report generation, review, frozen baseline, isolated repair verification, provenance-bearing proof integration, held-out evaluation, and portfolio packaging are implemented through AR7
**Historical Documents**: For older milestone audits, see [Historical Review Index](#historical-reviews).

> **Evidence storage:** raw runs, traces, screenshots, logs, and proof ZIPs are local Git-ignored artifacts. Public, sanitized release evidence is retained in [`docs/evidence/ar7-evaluation.md`](evidence/ar7-evaluation.md).

---

## 1. Project Overview & Objective

Bug-to-Proof is an evidence-backed repair and verification prototype for the configured local MiniShop project. Given a case with an existing trusted reproduction test, Bug-to-Proof transforms it into:
1. **A Focused Reproduction Test**: An isolated Playwright test targeting the reported defect.
2. **A Recorded Baseline Failure**: Verified `ASSERTION_FAILED` result on the unmodified application.
3. **A Minimal, Reviewable Patch**: Isolated code proposal with cryptographic SHA-256 approval binding.
4. **Passing Verification**: Verified `PASSED` outcome on the identical reproduction test after applying the patch.
5. **Independent Regression Checks**: Automated suite verifying TypeScript compilation (`tsc`), production Vite build (`vite build`), and unit tests (`vitest`).
6. **A Cryptographic Proof Bundle**: A standalone PKZIP archive containing a versioned manifest with SHA-256 checksums, bug snapshot, reproduction spec, test results, logs, screenshots, and a Markdown report.

### Current limitation

A complete arbitrary report can now generate a discovery-bound candidate, receive hash-bound human approval, freeze the accepted test, confirm a failing baseline, verify a reviewed isolated patch with the identical test, run required regressions, and export a provenance-bearing proof bundle. AR7 includes a reproducible scorecard, a frozen 2-development/4-held-out arbitrary-report set, one retained held-out execution, and portfolio/demo materials. Held-out results were 2/4 valid candidates, 1/4 executable passing baseline, 0/4 relevant reproductions, and 2/4 provider-connectivity failures. That run exposed a trusted-input locator mismatch; compiler 1.1.0 adds inventory-bound `fillTarget`, verified with a real browser fixture, without rerunning the consumed split. The recorded AR6 end-to-end patch proposal remains deterministic reference output; a live-model repair of arbitrary source was not sent without separate authorization. See the [arbitrary reproduction tracker](progress/arbitrary-bug-reproduction.md).

---

## 2. Core Implemented & Verified Improvements

### Improvement 1: Repair-Run Persistence Reliability & Startup Resiliency
- **Atomic File Replacement**: Uses temporary file creation with atomic replacement (`fs.renameSync`). On `EPERM`, `EBUSY`, or `EACCES` failure:
  - The previous `run.json` is preserved byte-for-byte without unsafe overwrite fallbacks.
  - The temporary `.tmp` file is immediately cleaned up.
  - Throws structured `RunStorageError` mapped to HTTP 503 (`SERVICE_UNAVAILABLE`).
- **Distinguishable Error Diagnostics**:
  - `RunStorageError` -> HTTP `503 Service Unavailable`.
  - `CorruptRunRecordError` -> HTTP `500 Internal Server Error` with corrupt file path diagnostic.
  - `404 Not Found` returned strictly for missing records with invalid ID format checking.
- **Resilient Startup Recovery**: Startup scanning (`recoverInterruptedRuns`) inspects run records individually. Corrupt JSON files are logged and preserved byte-for-byte on disk without being deleted or overwritten, while valid interrupted runs are safely reconciled to `BLOCKED` (and `AWAITING_REVIEW` runs remain reviewable).
- **Evidence**:
  - Unit Suite: [`services/api/src/ai/repair/runStorePersistence.test.ts`](../services/api/src/ai/repair/runStorePersistence.test.ts) (6/6 tests passing).
  - API Routes: [`services/api/src/routes/aiRepair.test.ts`](../services/api/src/routes/aiRepair.test.ts) (5/5 tests passing).

### Improvement 2: Broader Repair Benchmark (8 Diverse Cases)
- Expanded `data/evals/repair-cases.json` from 5 to 8 benchmark cases covering:
  1. `case-001-cart-total`: Calculation defect in cart item summation.
  2. `case-002-repeated-item-qty`: State defect in quantity incrementing.
  3. `case-003-item-removal`: State defect in item deletion.
  4. `case-004-cart-clear`: State defect in checkout cart clearance.
  5. `case-005-cart-total-quantities`: Calculation defect with multi-quantity items.
  6. `case-006-nav-cart-count`: **UI Rendering Defect** in `App.tsx` badge rendering unique items instead of total quantity.
  7. `case-007-promo-discount`: **Asynchronous State / Ordering Defect** where concurrent item addition during async network delay is overwritten by a stale pre-await snapshot in `cartStore.ts`.
  8. `case-008-tiered-shipping`: **Multi-File Coordinated Defect** requiring coordinated modifications across `cartStore.ts` and `Cart.tsx`.
- Evaluation Runner (`scripts/evaluate-repair.ts`):
  - Multi-file defect seeding in isolated sandbox directories.
  - Explicit metrics tracking First-Attempt Success, Multi-Attempt Success, Baseline Reproduction Rate, and Verification Rate.
  - Honest token usage and cost accounting (costs reported as unavailable unless explicit pricing config provided).
- **Evidence**:
  - Benchmark run: `npx tsx scripts/evaluate-repair.ts --simulated` (8/8 cases verified, 100% baseline reproduction rate, 100% verification rate).
  - Real browser reference validation: `npx tsx scripts/verify-benchmark-reference.ts` (3/3 new cases verified in real browser).
  - Playwright specs: [`tests/playwright/cases/`](../tests/playwright/cases/).

### Improvement 3: Downloadable Proof Bundle (.zip) & Secure Archive Collection
- **Pre-Read Bounds & Limits Enforced Before File Loading**:
  - File size (`stat.size`), entry count, and cumulative input size are checked before reading each artifact into memory.
  - Throws actionable `OversizedArchiveError` when entry limit (200), single file limit (50 MB), cumulative input limit (100 MB), or output archive limit (100 MB) is exceeded.
  - Streaming/bounded reads prevent files that grow concurrently from bypassing size constraints.
- **Secure Archive Collection & Allowlist Filtering**:
  - Path-relative and `realpath` validation (`validateArtifactContainment`) rejecting path traversal and symlink / junction escapes.
  - Strict allowlist filtering and explicit sensitive file exclusion (`.env`, `credentials*`, `secret*`, `token*`, `password*`, `apikey*`, `.lock`, `.tmp`, `.exe`, `.bat`, `.cmd`, `node_modules`, `.git`).
  - Collection of approved run-specific artifacts and nested Playwright traces/screenshots with deduplicated, singular archive paths (no repeated directory prefixes).
  - Explicit diagnostic errors for unreadable or missing required evidence, preventing false `verified=true` bundles.
- **Immutable Run Inputs**:
  - Captured at run creation: immutable bug case snapshot (`caseSnapshot`) and exact reproduction test content (`reproductionTest`).
  - Exported directly from captured inputs; does not substitute live edited case records for original run inputs.
  - Legacy runs without snapshots explicitly report inputs as `UNAVAILABLE`.
- **Zero-Dependency PKZIP 2.0 Archiving**:
  - Implemented in [`services/api/src/utils/zip.ts`](../services/api/src/utils/zip.ts) with Deflate raw compression and CRC32 table.
  - Non-circular manifest describing all payload files.
  - Independent extraction reader (`extractZipArchive`) verifying CRC-32 and payload SHA-256 digests from extracted bytes.
- **Evidence**:
  - Bundle Builder: [`services/api/src/ai/repair/proofBundle.ts`](../services/api/src/ai/repair/proofBundle.ts).
  - API Route: `GET /api/ai/repair-runs/:runId/bundle.zip`.
  - Dashboard Action: Download Proof Bundle link in [`apps/dashboard/src/components/AIAssistant.tsx`](../apps/dashboard/src/components/AIAssistant.tsx).
  - Unit Tests: [`services/api/src/ai/repair/proofBundle.test.ts`](../services/api/src/ai/repair/proofBundle.test.ts) (12/12 tests passing).

### Improvement 4: Fail-Closed Verification Gates
- Centralized gate enforcement (`validateVerificationGates`):
  - Canonical proposal hash recomputation (`computeProposalHash`) ensuring proposed edits and diagnosis were not tampered.
  - Approval binding verification: `review.proposalId === proposal.proposalId` and `review.proposalHash === proposal.proposalHash`.
  - Baseline classification requirement: `baselineRun.outcome === "ASSERTION_FAILED"`.
  - Post-patch verification requirement: `postPatchRun.outcome === "PASSED"`.
  - Matching test fingerprints and test identities across phases.
  - 100% passing results across all mandatory regression check types (`typecheck`, `build`, `unit-tests`) with `exitCode === 0`.
  - Verification of disk evidence reports and manifests with matching SHA-256 report digests.
- **Evidence**:
  - Unit Tests: [`services/api/src/ai/repair/verification.test.ts`](../services/api/src/ai/repair/verification.test.ts) (9/9 tests passing).

### Improvement 5: Windows & Linux CI Coverage
- **GitHub Actions Matrix**: `.github/workflows/ci.yml` covers `[ubuntu-latest, windows-latest]` with Node.js 22 and `npm ci`.
- **Comprehensive Workflow Steps**:
  1. Monorepo typechecking (`npm run typecheck`).
  2. Full unit test suite (`npm run test:unit`) covering persistence, lifecycle, recovery, gates, and bundle generation.
  3. Production builds (`npm run build`).
  4. Playwright browser installation.
  5. Repair benchmark simulated evaluation (`npx tsx scripts/evaluate-repair.ts --simulated`).
  6. Real browser failure-to-pass workflow execution (`npx tsx scripts/verify-real-browser-workflow.ts`).
  7. Proof and verification artifact uploads with bounded timeouts.
- **Evidence**:
  - Workflow File: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
  - Local Windows Execution: Real browser test verified (Run ID: `run-94b224af-9b32-417e-b346-58dc43c7e9bb`).

### Improvement 6: Artifact Hygiene & Safe Cleanup
- **Artifact Hygiene**:
  - Clear separation between curated evidence (`artifacts/evaluation/`, `artifacts/system-testing/`, `artifacts/portfolio-cart/`) and ephemeral run workspaces.
  - Safe cleanup tool (`scripts/clean-artifacts.ts` / `npm run artifacts:clean`) defaults to `--dry-run`, protects active and awaiting-review runs, protects pinned runs, preserves corrupt audit records, and prevents path traversal.
- **Evidence**:
  - Cleanup Script: [`scripts/clean-artifacts.ts`](../scripts/clean-artifacts.ts).
  - Cleanup Unit Tests: [`services/api/src/storage/cleanArtifacts.test.ts`](../services/api/src/storage/cleanArtifacts.test.ts) (2/2 tests passing).

---

## 3. Verification Matrix

| Area / Feature | Expected Behavior | Execution Mode | Evidence Path | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Run Persistence Reliability** | Atomically writes run records; preserves previous valid record on `renameSync` failure; cleans up temporary files; throws `RunStorageError`. | Automated Unit Tests (Fault Injection) | [`services/api/src/ai/repair/runStorePersistence.test.ts`](../services/api/src/ai/repair/runStorePersistence.test.ts) | **PASS** |
| **Corrupt Record Handling** | Explicit 500 error for corrupt single run; explicit 500 for listing runs with corrupt file; preserves corrupt bytes untouched during recovery. | Automated Unit & Integration Tests | [`services/api/src/ai/repair/runStorePersistence.test.ts`](../services/api/src/ai/repair/runStorePersistence.test.ts)<br>[`services/api/src/routes/aiRepair.test.ts`](../services/api/src/routes/aiRepair.test.ts) | **PASS** |
| **Fail-Closed Verification Gates** | Recomputes proposal hash; validates exact approval binding; verifies baseline failure & post-patch pass; verifies mandatory regression checks. | Automated Negative & Boundary Tests | [`services/api/src/ai/repair/verification.test.ts`](../services/api/src/ai/repair/verification.test.ts) | **PASS** |
| **Secure Proof Bundle Export** | Pre-read size & entry limits (`OversizedArchiveError`); allowlist artifact collection; sensitive file exclusion; no path duplicates; exports ZIP with manifest, case snapshot, reproduction spec, baseline/verification results, approved diff, and Markdown report. | Unit Tests & Real Extraction Validation | [`services/api/src/ai/repair/proofBundle.test.ts`](../services/api/src/ai/repair/proofBundle.test.ts)<br>`artifacts/runs/run-94b224af-9b32-417e-b346-58dc43c7e9bb/proof-bundle-case-001-run-94b224af-9b32-417e-b346-58dc43c7e9bb.zip` | **PASS** |
| **Expanded Repair Benchmark** | 8 deterministic cases (UI, Async, MultiFile); 100% reproduction and verification pass rate; honest metrics and cost reporting. | Synthetic Simulation Benchmark Harness | [`artifacts/repair-evaluation-report.json`](../artifacts/repair-evaluation-report.json)<br>[`scripts/evaluate-repair.ts`](../scripts/evaluate-repair.ts) | **PASS** |
| **Real Browser Reference Validation** | Seeds new UI, Async, and MultiFile cases from canonical dataset; records `ASSERTION_FAILED` baseline, `PASSED` post-patch, and passing regressions in real browser; cleans up app process and lock in `finally`. | Real Playwright Browser Runner | `artifacts/evaluation/reference-browser-validation/reference-browser-results.json`<br>[`scripts/verify-benchmark-reference.ts`](../scripts/verify-benchmark-reference.ts) | **PASS** |
| **Real Browser Workflow** | End-to-end failure-to-pass workflow: seeds defect, records baseline failure, approves proposal, verifies post-patch pass and regression checks, exports and validates proof bundle. | Real Playwright Browser Runner | `artifacts/system-testing/real-browser-verification/browser-workflow-result.json`<br>[`scripts/verify-real-browser-workflow.ts`](../scripts/verify-real-browser-workflow.ts) | **PASS** |
| **Monorepo Typechecking** | Monorepo TypeScript builds pass without errors (`tsc --noEmit` across API, Dashboard, MiniShop). | Static Compilation | `npm run typecheck` (Exit code: 0) | **PASS** |
| **Full Unit Suite** | 44 test suites across API, Dashboard, and MiniShop execute cleanly. | Unit Test Runner | `npm run test:unit -- --no-file-parallelism` (198/198 tests passed) | **PASS** |
| **Production Build Validation** | Dashboard and MiniShop build production bundles without errors. | Vite Production Build | `npm run build` (Exit code: 0) | **PASS** |
| **Live LLM Model Evaluation** | Real model evaluation using live OpenAI/Ollama APIs. | Live LLM Provider Execution | Gated on `LLM_API_KEY`; skips gracefully without false failures | **NOT RUN** (No API Key Configured) |
| **Hosted GitHub Actions CI** | Multi-OS workflow execution on GitHub-hosted Ubuntu and Windows runners. | Remote GitHub Actions | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Local Windows verified) | **NOT RUN** (Pending Remote Trigger) |

---

## 4. Historical Reviews

The following documents represent point-in-time review snapshots from previous milestones and are preserved for historical audit purposes:
- [`startup-fix-verification.md`](startup-fix-verification.md)
- [`final-followup-review.md`](final-followup-review.md)
- [`latest-review.md`](latest-review.md)
- [`project-recheck.md`](project-recheck.md)
- [`project-review-prompt.md`](project-review-prompt.md)
