import type { BugReportDetails, ReportCompleteness } from "@bug-to-proof/shared-types";

export function assessReportCompleteness(report: BugReportDetails): ReportCompleteness {
  const missingFields: ReportCompleteness["missingFields"] = [];
  if (report.steps.length === 0) missingFields.push("steps");
  if (!report.expected.trim()) missingFields.push("expected");
  if (!report.actual.trim()) missingFields.push("actual");
  return { complete: missingFields.length === 0, missingFields };
}
