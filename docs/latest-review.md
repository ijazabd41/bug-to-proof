> [!NOTE]
> **Historical Milestone Document**: This document represents a historical audit. For current architecture, verification matrix, and system status, see [Current Project Status](current-project-status.md).

# Latest follow-up review

Most prior findings are addressed in the current source: nested evidence delivery, asynchronous repair creation, atomic rename failure preserving the previous case, explicit corrupt-record responses, dynamic run guards, and a real browser CI step with artifact upload.

## Remaining findings

- **P1: dynamic case edit/delete guard omits active states.** `services/api/src/routes/cases.ts:28` lists INITIALIZING, REPRODUCING_BASELINE, PROPOSING, AWAITING_REVIEW, and RUNNING_CHECKS. The defined lifecycle also includes INVESTIGATING, APPLYING, and VERIFYING_REPRODUCTION. Cases can be edited or deleted during these omitted phases because the separate case status can remain idle. Existing guard tests exercise AWAITING_REVIEW and CANCELLED only. Cover every active state with parameterized API tests and derive the guard from a shared lifecycle classification.
- **P2: persistence contention still blocks the event loop and lacks an API retry response.** `caseStore.ts` replaced spinning with `Atomics.wait`, which still synchronously blocks the main thread for up to 150ms across failed retries. `CaseStorageError` is not specially handled by `errorHandler.ts`, so callers receive a generic 500 instead of a structured retryable storage response. The prior file-corruption fallback is fixed; this is a remaining availability/error-handling concern.
- **P2: case list still silently omits corrupt records.** Single-case reads now throw a distinct error, but `readAllCases` logs and skips invalid JSON; list callers do not know their results are incomplete. Return an explicit diagnostic or a documented error policy.

These remaining findings come from code inspection, not newly executed behavior reproductions. No application code was changed during this review.

## Fresh verification

- Typecheck: passed, exit 0.
- Dashboard and MiniShop production builds: passed, exit 0.
- Real browser evidence workflow: passed, exit 0; run `run-ec816b58-2dd8-4dae-aac6-a9a13efbe3ec` reached VERIFIED.
- Browser baseline: ASSERTION_FAILED, cart expected $30.00 and received $10.00.
- Post-patch: PASSED using the same two reproduction test identities.
- Candidate typecheck, build, and unit checks: all three passed.
- Unit suite: passed, 150/150 tests, exit 0; report `artifacts/recheck-latest/unit.json`.

Fresh command logs are in `artifacts/recheck-latest/`. Browser report: `artifacts/system-testing/real-browser-verification/browser-workflow-result.json`. The previous browser summary was preserved as `artifacts/recheck-latest/previous-browser-result.json`. The browser workflow uses a deterministic proposal generator and real browser/regression execution; it does not validate live model generation or execution on GitHub CI.
