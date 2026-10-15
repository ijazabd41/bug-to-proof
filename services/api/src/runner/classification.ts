import { Buffer } from "buffer";
/** Fail closed: only labelled behavior assertions prove a reported bug. */
const readable = (message: string) => message.replace(/\x1b\[[0-9;]*m/g, "");
const failureKind = (message: string) => {
  if (/executable.*(missing|doesn.t exist)|browserType\.launch/i.test(message)) return "BROWSER_UNAVAILABLE" as const;
  if (/ERR_CONNECTION_REFUSED|not reachable|ECONNREFUSED/i.test(message)) return "TARGET_UNREACHABLE" as const;
  if (/locator\.|page\.(click|fill|selectOption)|Timeout.*exceeded/i.test(message)) return "SELECTOR_OR_ACTION_ERROR" as const;
  return "INVALID_REPORT" as const;
};
export function classifyReport(report: any, code: number | null) {
  const tests: any[] = [];
  const visit = (suite: any) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) tests.push({ ...test, identity: `${spec.file}:${spec.title}:${test.projectName}` });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  const ids = tests.map((test) => test.identity).sort();
  const results = tests.map((test) => test.results?.length === 1 ? test.results[0] : null);
  if (report.errors?.length || !tests.length || new Set(ids).size !== ids.length || tests.some((t) => t.expectedStatus !== "passed") || results.some((r) => !r || !["passed", "failed"].includes(r.status))) {
    const detail = readable([...(report.errors ?? []), ...results.flatMap((result: any) => result ? [result.error, ...(result.errors ?? [])] : [])]
      .filter(Boolean).map((error: any) => error?.message ?? String(error)).join("\n"));
    return { outcome: "INFRASTRUCTURE_ERROR" as const, failureKind: failureKind(detail), testIds: ids, actual: detail || "No complete, unambiguous test execution" };
  }
  const failures = results.filter((r) => r.status === "failed");
  if (!failures.length && code === 0 && report.stats?.expected === tests.length && report.stats?.unexpected === 0) {
    return { outcome: "PASSED" as const, testIds: ids, actual: "All selected tests passed" };
  }
  const assertion = (error: any) => /BTP_ASSERTION:/.test(error?.message ?? "") &&
    /Expected:/.test(error?.message ?? "") && /Received:/.test(error?.message ?? "");
  const hasBehaviorEvidence = (result: any) => (result.attachments ?? []).some((attachment: any) => {
    if (attachment.name !== "btp-assertion" || attachment.contentType !== "application/json" || !attachment.body) return false;
    try {
      const values = JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
      return typeof values.actual === "string" && typeof values.expected === "string" && values.actual !== values.expected;
    } catch { return false; }
  });
  if (code === 1 && failures.length && report.stats?.unexpected === failures.length &&
    failures.every((r) => hasBehaviorEvidence(r) && (r.errors?.length ? r.errors.every(assertion) : assertion(r.error)))) {
    return { outcome: "ASSERTION_FAILED" as const, testIds: ids,
      actual: readable(failures.map((r) => r.error?.message ?? r.errors?.[0]?.message).join("\n")) };
  }
  const actual = readable(failures.map((r) => r.error?.message ?? r.errors?.[0]?.message ?? "Unknown test failure").join("\n")) || "Process/report disagreement";
  return { outcome: "INFRASTRUCTURE_ERROR" as const, failureKind: failureKind(actual), testIds: ids, actual };
}
