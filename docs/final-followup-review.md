> [!NOTE]
> **Historical Milestone Document**: This document represents a historical audit. For current architecture, verification matrix, and system status, see [Current Project Status](current-project-status.md).

# Follow-up verification

The three requested fixes are present:

- Case edit/delete guards use the shared active-state classification, including INVESTIGATING, APPLYING, and VERIFYING_REPRODUCTION. Tests enumerate active states and terminal deletion behavior.
- Atomic rename failure preserves the existing record, removes the temporary file, and returns a structured retryable 503 through the API. Atomics.wait retries were removed.
- The list endpoint explicitly reports corrupt JSON instead of silently skipping it.

## Confirmed remaining regression

**P1: a corrupt case file prevents API startup.** `services/api/src/index.ts:183` calls `recoverInterruptedLegacyCases()` during module initialization. Recovery calls `readAllCases()`, which now throws on the first invalid JSON file. No startup boundary catches this error, so API initialization exits before the server can expose the new corruption diagnostics.

An isolated child-process probe reproduced this using a dedicated DATA_DIR containing one invalid case file. Expected initialization exit: 0. Actual: 1, with an uncaught CorruptCaseRecordError traced through readAllCases -> recoverInterruptedLegacyCases -> index.ts. Real case files were not changed. Probe source and output: `artifacts/recheck-final/startup-probe.cjs` and `startup-probe.json`.

Existing corrupt-record API tests import the app before writing their corrupt fixture, so they do not cover restart with existing corruption. Add a child-process startup regression test, keep the API available with explicit diagnostics, and reconcile valid records without inventing outcomes for corrupt ones. Preserve the explicit list/single-case error policy.

## Verification

Typecheck and dashboard/MiniShop builds passed (exit 0). The unit suite passed 170/170 tests (exit 0), recorded in `artifacts/recheck-final/unit.json`. Logs are in the same directory. The separate startup probe failed with the confirmed regression above. No application code was changed. No fresh browser workflow was run in this follow-up; the preceding review's browser result remains historical evidence.
