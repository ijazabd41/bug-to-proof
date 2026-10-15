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
    setSaving(true);
    setError("");
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

  return <form onSubmit={submit} aria-label="Clarify bug report" style={{ display: "grid", gap: 10 }}>
    {error && <p role="alert">{error}</p>}
    <label>Reproduction steps<textarea value={steps} onChange={event => setSteps(event.target.value)} rows={3} disabled={saving} /></label>
    <label>Expected behavior<textarea value={expected} onChange={event => setExpected(event.target.value)} rows={2} disabled={saving} /></label>
    <label>Actual behavior<textarea value={actual} onChange={event => setActual(event.target.value)} rows={2} disabled={saving} /></label>
    <label>Starting path <span className="optional">Optional</span><input value={startPath} onChange={event => setStartPath(event.target.value)} placeholder="/cart" disabled={saving} /></label>
    <label>Additional context <span className="optional">Optional</span><textarea value={context} onChange={event => setContext(event.target.value)} rows={2} disabled={saving} /></label>
    <button className="button primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save report details"}</button>
  </form>;
}
