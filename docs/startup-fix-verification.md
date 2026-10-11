> [!NOTE]
> **Historical Milestone Document**: This document represents a historical audit. For current architecture, verification matrix, and system status, see [Current Project Status](current-project-status.md).

# Startup fix verification

The previously confirmed startup regression is fixed. Startup recovery scans records individually, reports invalid files, preserves their contents, and continues reconciling valid cases. The case-list and single-case API readers retain explicit corruption errors.

The original unchanged probe was rerun against the current application. API initialization exited 0; the prior recorded execution exited 1 with CorruptCaseRecordError. Prior output was preserved in `artifacts/startup-fix-review/baseline-probe.json`; fresh output is `fixed-probe.json`, with command output in `probe.log`.

The new child-process regression tests cover corruption present before initialization, preservation of corrupt bytes, recovery of a valid REPRODUCING case, and a healthy-start control recovering a VERIFYING case while preserving an idle case.

Typecheck and both production builds passed (exit 0). The full unit suite passed 172/172 tests (exit 0), including the new startup regression tests; results are recorded in `artifacts/startup-fix-review/unit.json`. No application code was edited during this review. No new browser run was necessary for this startup-only change; this review makes no new live-model or browser verification claim.

Minor cleanup: the first startup regression test title says startup fails, although its assertions correctly require successful startup. Rename it to describe the fixed behavior.
