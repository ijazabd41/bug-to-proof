import React, { useState } from "react";
import type { BugCase, BugReportDetails } from "../types";
import { api } from "../api/client";

export function ReportClarification({ bugCase, onUpdate }: { bugCase: BugCase; onUpdate: (updated: BugCase) => void }) {
  const initial = bugCase.report ?? { schemaVersion: "1.0", steps: [], expected: "", actual: "", startPath: "", context: "" };
  const [steps, setSteps] = useState(initial.steps.join("\n"));
  const [expected, setExpected] = useState(initial.expected);
  const [actual, setActual] = useState(initial.actual);
  const [startPath, setStartPath] = useState(initial.startPath);
  const [context, setContext] = useState(initial.context);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!steps.trim()) { setError("Reproduction steps are required."); return; }
    if (!expected.trim()) { setError("Expected behavior is required."); return; }
    if (!actual.trim()) { setError("Actual behavior is required."); return; }
    setSaving(true);
    const report: BugReportDetails = {
      schemaVersion: "1.0",
      steps: steps.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      expected: expected.trim(),
      actual: actual.trim(),
      startPath: startPath.trim(),
      context: context.trim(),
    };
    try {
      onUpdate(await api.updateCase(bugCase.id, { report }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update report details");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} aria-label="Clarify bug report" className="report-clarification" noValidate>
    {error && <p role="alert" className="report-clarification-error">{error}</p>}
    <label htmlFor="clarification-steps">Reproduction steps <span className="required" aria-hidden="true">*</span></label>
    <textarea id="clarification-steps" value={steps} onChange={event => setSteps(event.target.value)} rows={3} disabled={saving} required aria-required="true" placeholder={"1. Open the shop\n2. Add products to the cart\n3. Check the total"} />
    <div className="clarification-outcomes">
      <div><label htmlFor="clarification-expected">Expected behavior <span className="required" aria-hidden="true">*</span></label><textarea id="clarification-expected" value={expected} onChange={event => setExpected(event.target.value)} rows={3} disabled={saving} required aria-required="true" /></div>
      <div><label htmlFor="clarification-actual">Actual behavior <span className="required" aria-hidden="true">*</span></label><textarea id="clarification-actual" value={actual} onChange={event => setActual(event.target.value)} rows={3} disabled={saving} required aria-required="true" /></div>
    </div>
    <label htmlFor="clarification-path">Starting path <span className="optional">Optional</span></label><input id="clarification-path" value={startPath} onChange={event => setStartPath(event.target.value)} placeholder="/cart" disabled={saving} />
    <label htmlFor="clarification-context">Additional context <span className="optional">Optional</span></label><textarea id="clarification-context" value={context} onChange={event => setContext(event.target.value)} rows={2} disabled={saving} />
    <button className="button primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save report details"}</button>
  </form>;
}
