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
  const [startPath, setStartPath] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      titleRef.current?.focus();
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!steps.trim()) {
      setError("Reproduction steps are required.");
      return;
    }
    if (!expected.trim()) {
      setError("Expected behavior is required.");
      return;
    }
    if (!actual.trim()) {
      setError("Actual behavior is required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createCase({
        title: title.trim(),
        description: description.trim(),
        steps: steps
          .split(/\r?\n/)
          .map((step) => step.trim())
          .filter(Boolean),
        expected: expected.trim(),
        actual: actual.trim(),
        startPath: startPath.trim(),
        context: context.trim(),
      });
      onCreated(created);
      navigate(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="report-panel panel" aria-labelledby="bug-form-title">
      <div className="report-header">
        <span className="eyebrow">START WITH THE BEHAVIOR</span>
        <h2 id="bug-form-title">Report a bug</h2>
        <p className="panel-description">
          Describe what broke. Build a fix with evidence you can review.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="error-banner">
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="bug-title">
            Title <span className="required">*</span>
          </label>
          <input
            id="bug-title"
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A brief, descriptive summary of the issue"
            disabled={submitting}
            aria-required="true"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bug-description">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="bug-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Include any relevant user workflow or unexpected side effects."
            rows={3}
            disabled={submitting}
            aria-required="true"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bug-steps">
            Reproduction steps <span className="required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="bug-steps"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"1. Open the cart\n2. Add two products\n3. Check the total"}
            rows={3}
            disabled={submitting}
            required
            aria-required="true"
          />
        </div>

        <div className="form-pair">
          <div className="form-group">
            <label htmlFor="bug-expected">
              Expected behavior <span className="required" aria-hidden="true">*</span>
            </label>
            <textarea
              id="bug-expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="What should happen?"
              rows={3}
              disabled={submitting}
              required
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="bug-actual">
              Actual behavior <span className="required" aria-hidden="true">*</span>
            </label>
            <textarea
              id="bug-actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="What happened instead?"
              rows={3}
              disabled={submitting}
              required
              aria-required="true"
            />
          </div>
        </div>

        <div className="form-pair">
          <div className="form-group">
            <label htmlFor="bug-start-path">
              Starting path <span className="optional">Optional</span>
            </label>
            <input
              id="bug-start-path"
              value={startPath}
              onChange={(e) => setStartPath(e.target.value)}
              placeholder="/cart"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="bug-context">
              Additional context <span className="optional">Optional</span>
            </label>
            <textarea
              id="bug-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Browser, account state, viewport, or other conditions"
              rows={2}
              disabled={submitting}
            />
          </div>
        </div>

        <button
          className="button primary create-case glow-button"
          type="submit"
          disabled={submitting}
        >
          <Icon name="plus" size={16} />
          <span>{submitting ? "Creating case…" : "Create case"}</span>
        </button>

        <p className="form-note">
          A report starts the investigation. Recorded browser tests establish the cryptographic result.
        </p>
      </form>
    </section>
  );
}
