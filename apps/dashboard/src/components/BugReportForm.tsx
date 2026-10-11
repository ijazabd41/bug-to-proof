import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { BugCase } from "../types";
import { Icon } from "./Icon";
export function BugReportForm({ onCreated }: { onCreated: (c: BugCase) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!title.trim()) { setError("Title is required."); titleRef.current?.focus(); return; }
    if (!description.trim()) { setError("Description is required."); return; }
    setSubmitting(true);
    try {
      // Preserve report context as text; reproduction evidence belongs to the runner.
      const context = [description.trim(), steps.trim() && `Steps to reproduce:\n${steps.trim()}`, expected.trim() && `Expected behavior:\n${expected.trim()}`, actual.trim() && `Actual behavior:\n${actual.trim()}`].filter(Boolean).join("\n\n");
      const created = await api.createCase({ title: title.trim(), description: context });
      onCreated(created); navigate(`/cases/${created.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create case"); }
    finally { setSubmitting(false); }
  }
  return <section className="report-panel panel" aria-labelledby="bug-form-title">
    <span className="eyebrow">START WITH THE BEHAVIOR</span><h2 id="bug-form-title">Report a bug</h2>
    <p className="panel-description">Describe what broke. Build a fix with evidence you can review.</p>
    <form onSubmit={handleSubmit} noValidate>
      {error && <div role="alert" className="error-banner">{error}</div>}
      <label htmlFor="bug-title">Title <span className="required">*</span></label>
      <input id="bug-title" ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="A brief, descriptive title" disabled={submitting} aria-required="true" />
      <label htmlFor="bug-description">Description <span className="required">*</span></label>
      <textarea id="bug-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened? Include any useful context." rows={4} disabled={submitting} aria-required="true" />
      <label htmlFor="bug-steps">Reproduction steps <span className="optional">Optional</span></label>
      <textarea id="bug-steps" value={steps} onChange={e => setSteps(e.target.value)} placeholder={"1. Open the cart\n2. Add two products\n3. Check the total"} rows={3} disabled={submitting} />
      <div className="form-pair"><div><label htmlFor="bug-expected">Expected behavior</label><textarea id="bug-expected" value={expected} onChange={e => setExpected(e.target.value)} placeholder="What should happen?" rows={3} disabled={submitting} /></div><div><label htmlFor="bug-actual">Actual behavior</label><textarea id="bug-actual" value={actual} onChange={e => setActual(e.target.value)} placeholder="What happened instead?" rows={3} disabled={submitting} /></div></div>
      <button className="button primary create-case" type="submit" disabled={submitting}><Icon name="plus" />{submitting ? "Creating case…" : "Create case"}</button>
      <p className="form-note">A report starts the investigation. Recorded tests establish the result.</p>
    </form>
  </section>;
}
