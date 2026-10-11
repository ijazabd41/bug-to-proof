> [!NOTE]
> **Historical Milestone Document**: This document represents a historical audit. For current architecture, verification matrix, and system status, see [Current Project Status](current-project-status.md).

# Follow-up review

The current working tree addresses many earlier findings: runtime validation, randomized case IDs, loopback default, CORS allowlist, legacy restart recovery, stale LLM update checks, saved repair-run loading, cancellation controls, generated-source cleanup, aligned Node requirements, and CI.

Remaining findings from source inspection:

1. **High: artifact delivery blocks generated evidence.** `services/api/src/runner/playwrightRunner.ts:45` writes to `<caseId>/<phase>/<runId>/`, whereas `services/api/src/index.ts` only allows a filename immediately under `<caseId>/<phase>/`. The agent writes `agent/<runId>/report.json`, which also fails the new allowlist. Repair run evidence under `runs/` is entirely denied. Preserve internal workspace/checkpoint restrictions while explicitly allowing public evidence paths. Add route tests using actual runner-generated paths.
2. **Medium: newly started runs remain invisible until execution returns.** `services/api/src/routes/ai.ts` still awaits `createAndStartRepairRun` before sending 201. `AIAssistant.tsx` receives its run ID only after that response. Saved-run polling and cancellation help restored runs, but do not provide progress/cancellation for a new run during the initial request. Persist and return the run ID before background execution; test with a deliberately pending execution dependency.
3. **Medium: writes still have a non-atomic fallback.** `caseStore.ts` falls back to `copyFileSync(tmpPath, filePath)` after rename retries. Copying over the destination can leave partial data on interruption. Keep the previous record intact when atomic replacement fails and expose a retryable failure. Synchronous spin waits also block request handling.
4. **Medium: active dynamic repair runs are not covered by case deletion guard.** `cases.ts` checks only legacy case status for deletion; dynamic runs have separate records. Check active repair records as well, or define and enforce a cancellation policy before deletion.
5. **Medium: CI does not execute browser evidence verification.** The final CI step invokes runner/route Vitest tests. The runner test mocks child_process; installing Chromium does not make this a real failure-to-pass browser workflow. Add a deterministic isolated browser workflow using the evidence runner and upload its outputs.
6. **Low: corrupt records still appear missing to API callers.** `CorruptCaseRecordError` is defined but not thrown; `readCase` returns null and list reads skip corrupt JSON. Logging improves diagnostics but does not distinguish corruption from a missing case at the API boundary.

These are static findings, not fresh reproduced application bugs. Application code was not edited during this review. Verification logs are in `artifacts/project-recheck/`.

Fresh verification: typecheck passed (exit 0); dashboard and MiniShop production builds passed outside the sandbox (exit 0); unit suite passed outside the sandbox (135/135, exit 0, `unit-unsandboxed.json`). Initial sandbox runs hit EPERM filesystem resolution, localhost EACCES, and file contention; those results are preserved separately. No fresh browser failure-to-pass workflow was executed. Passing existing tests does not resolve the source findings above.
