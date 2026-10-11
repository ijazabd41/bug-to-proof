import type { BugCase, TestRun, Evidence } from "@bug-to-proof/shared-types";
import type { RunResult } from "./playwrightRunner";

/** Only the evidence runner may populate run records. */
export function attachRun(bugCase: BugCase, result: RunResult, phase: "before" | "after"): TestRun {
  const now = new Date().toISOString();
  const items: Evidence[] = Object.entries(result.artifactPaths).map(([key, file]) => ({
    id: `ev-${result.runId}-${key}`, type: key === "resultJson" ? "result-json" : key as "screenshot" | "trace",
    phase, path: file!, createdAt: now, description: `Recorded ${phase} ${key}`,
  }));
  bugCase.evidence.push(...items);
  const run: TestRun = {
    runAt: now, passed: result.passed, outcome: result.outcome, actual: result.actual,
    expected: bugCase.reproduction?.expected ?? "", durationMs: result.durationMs,
    runId: result.runId, testFingerprint: result.testFingerprint, testIds: result.testIds,
    reportHash: result.reportHash, evidenceIds: items.map((e) => e.id),
  };
  bugCase.verification ??= { status: "PENDING", beforeRun: null, afterRun: null, comparison: null };
  if (phase === "before") {
    bugCase.verification = { status: "PENDING", beforeRun: run, afterRun: null, comparison: null };
    if (bugCase.reproduction) bugCase.reproduction.lastRun = run;
    bugCase.status = result.outcome === "ASSERTION_FAILED" ? "REPRODUCED" : "REPRODUCTION_FAILED";
  } else {
    bugCase.verification.afterRun = run;
  }
  bugCase.updatedAt = now;
  return run;
}
