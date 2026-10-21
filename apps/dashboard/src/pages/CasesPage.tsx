import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { BugCase } from "../types";
import { CaseList } from "../components/CaseList";
import { BugReportForm } from "../components/BugReportForm";
import { Icon } from "../components/Icon";

export function CasesPage() {
  const [cases, setCases] = useState<BugCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const reportDialog = useRef<HTMLDialogElement>(null);

  const loadCases = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setCases(await api.getCases());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const statuses = useMemo(() => Array.from(new Set(cases.map((item) => item.status))).sort(), [cases]);

  const stats = useMemo(() => {
    const total = cases.length;
    const verified = cases.filter((c) => c.status === "VERIFIED").length;
    const reproduced = cases.filter((c) => c.status === "REPRODUCED").length;
    const inProgress = cases.filter((c) =>
      ["REPRODUCING", "READY_TO_REPRODUCE", "PATCH_PROPOSED", "VERIFYING"].includes(c.status)
    ).length;
    return { total, verified, reproduced, inProgress };
  }, [cases]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCases = cases.filter((item) => {
    const matchesStatus = status === "ALL" || item.status === status;
    const matchesQuery =
      !normalizedQuery ||
      [item.title, item.description, item.id].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    return matchesStatus && matchesQuery;
  });

  const filtersActive = normalizedQuery.length > 0 || status !== "ALL";

  return (
    <div className="cases-page">
      {/* ── Page Hero & Actions ── */}
      <section className="page-intro" aria-labelledby="cases-title">
        <div className="intro-text">
          <div className="intro-badge">
            <span className="live-indicator-dot" />
            <span className="eyebrow">CASEWORK / OVERVIEW</span>
          </div>
          <h1 id="cases-title">
            Investigations<span className="heading-dot">.</span>
          </h1>
          <p>Trace the failure. Review the change. Keep the evidence.</p>
        </div>
        <div className="intro-actions">
          <button
            type="button"
            className="button primary new-report glow-button"
            onClick={() => reportDialog.current?.showModal()}
          >
            <Icon name="plus" size={16} />
            <span>New report</span>
          </button>
        </div>
      </section>

      {/* ── Metric Highlights Ribbon ── */}
      <section className="metrics-ribbon" aria-label="Investigation statistics">
        <div
          className={`metric-card ${status === "ALL" ? "active-filter" : ""}`}
          onClick={() => setStatus("ALL")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStatus("ALL"); }}
        >
          <span className="metric-label">Total Cases</span>
          <div className="metric-value-row">
            <span className="metric-value">{loading ? "…" : stats.total}</span>
            <span className="metric-icon"><Icon name="cases" size={16} /></span>
          </div>
          <span className="metric-sub">Tracked investigations</span>
        </div>

        <div
          className={`metric-card verified-card ${status === "VERIFIED" ? "active-filter" : ""}`}
          onClick={() => setStatus(status === "VERIFIED" ? "ALL" : "VERIFIED")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStatus(status === "VERIFIED" ? "ALL" : "VERIFIED"); }}
        >
          <span className="metric-label">Verified Proofs</span>
          <div className="metric-value-row">
            <span className="metric-value text-emerald">{loading ? "…" : stats.verified}</span>
            <span className="metric-icon text-emerald"><Icon name="shield" size={16} /></span>
          </div>
          <span className="metric-sub">Passing unchanged tests</span>
        </div>

        <div
          className={`metric-card reproduced-card ${status === "REPRODUCED" ? "active-filter" : ""}`}
          onClick={() => setStatus(status === "REPRODUCED" ? "ALL" : "REPRODUCED")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStatus(status === "REPRODUCED" ? "ALL" : "REPRODUCED"); }}
        >
          <span className="metric-label">Confirmed Bugs</span>
          <div className="metric-value-row">
            <span className="metric-value text-rose">{loading ? "…" : stats.reproduced}</span>
            <span className="metric-icon text-rose"><Icon name="terminal" size={16} /></span>
          </div>
          <span className="metric-sub">Reproduced failure baselines</span>
        </div>

        <div
          className={`metric-card pipeline-card`}
          onClick={() => {
            if (stats.inProgress > 0) {
              const firstActive = statuses.find((s) =>
                ["REPRODUCING", "READY_TO_REPRODUCE", "PATCH_PROPOSED", "VERIFYING"].includes(s)
              );
              if (firstActive) setStatus(firstActive);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="metric-label">Active Pipeline</span>
          <div className="metric-value-row">
            <span className="metric-value text-cyan">{loading ? "…" : stats.inProgress}</span>
            <span className="metric-icon text-cyan"><Icon name="sparkles" size={16} /></span>
          </div>
          <span className="metric-sub">In reproduction or patch</span>
        </div>
      </section>

      {/* ── Main Cases Register Panel ── */}
      <div className="overview-grid">
        <div className="cases-column">
          <section className="panel cases-panel" aria-labelledby="case-list-title">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR CASES</span>
                <h2 id="case-list-title">Case register</h2>
              </div>
              <span className="count-chip">
                {loading
                  ? "Loading…"
                  : error
                  ? "Unavailable"
                  : `${visibleCases.length} shown · ${cases.length} total`}
              </span>
            </div>

            <div className="case-filters" role="search">
              <label className="search-field">
                <span className="sr-only">Search cases</span>
                <div className="search-input-wrap">
                  <span className="search-icon"><Icon name="search" size={14} /></span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by title, description, or case ID…"
                  />
                </div>
              </label>

              <label className="filter-select-wrap">
                <span className="sr-only">Filter by status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              {filtersActive && (
                <button
                  className="clear-filters"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("ALL");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {error ? (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button className="button" onClick={() => void loadCases()}>
                  Retry
                </button>
              </div>
            ) : (
              <CaseList
                cases={visibleCases}
                loading={loading}
                error={null}
                emptyMessage={filtersActive ? "No cases match these filters." : undefined}
              />
            )}

            <div className="evidence-note">
              <Icon name="proof" size={15} />
              <span>Each result is tied to a cryptographically recorded test run.</span>
            </div>
          </section>
        </div>
      </div>

      {/* ── New Report Modal Dialog ── */}
      <dialog
        ref={reportDialog}
        className="report-dialog"
        aria-labelledby="bug-form-title"
        onClick={(event) => {
          if (event.target === reportDialog.current) reportDialog.current.close();
        }}
      >
        <div className="report-dialog-content">
          <button
            type="button"
            className="dialog-close"
            aria-label="Close report form"
            onClick={() => reportDialog.current?.close()}
          >
            ✕
          </button>
          <BugReportForm onCreated={(c) => setCases((prev) => [c, ...prev])} />
        </div>
      </dialog>
    </div>
  );
}
