import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { BugCase } from "../types";
import { CaseList } from "../components/CaseList";
import { BugReportForm } from "../components/BugReportForm";
import { Workflow } from "../components/Workflow";
import { Icon } from "../components/Icon";
export function CasesPage() {
  const [cases, setCases] = useState<BugCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const loadCases = useCallback(async () => {
    setError(null); setLoading(true);
    try { setCases(await api.getCases()); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load cases"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadCases(); }, [loadCases]);
  const statuses = Array.from(new Set(cases.map(item => item.status))).sort();
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCases = cases.filter(item => {
    const matchesStatus = status === "ALL" || item.status === status;
    const matchesQuery = !normalizedQuery || [item.title, item.description, item.id]
      .some(value => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });
  const filtersActive = normalizedQuery.length > 0 || status !== "ALL";
  return <div>
    <div className="page-heading"><div><span className="eyebrow">FROM REPORT TO RESOLUTION</span><h1>Bug cases<span className="heading-dot">.</span></h1><p>Reproduce the failure. Review the fix. Keep the proof.</p></div><a href="#bug-title" className="button primary"><Icon name="plus" />Report a bug</a></div>
    <div className="overview-grid"><div className="cases-column"><Workflow />
      <section className="panel cases-panel" aria-labelledby="case-list-title"><div className="panel-heading"><h2 id="case-list-title">Your cases</h2><span className="count-chip">{loading ? "Loading…" : error ? "Unavailable" : `${visibleCases.length} of ${cases.length}`}</span></div>
        <div className="case-filters" role="search">
          <label className="search-field"><span className="sr-only">Search cases</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search cases" /></label>
          <label><span className="sr-only">Filter by status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label>
          {filtersActive && <button className="clear-filters" type="button" onClick={() => { setQuery(""); setStatus("ALL"); }}>Clear</button>}
        </div>
        {error ? <div className="error-banner" role="alert"><span>{error}</span><button className="button" onClick={() => void loadCases()}>Retry</button></div> : <CaseList cases={visibleCases} loading={loading} error={null} emptyMessage={filtersActive ? "No cases match these filters." : undefined} />}
        <div className="evidence-note"><Icon name="proof" /><span>Success is backed by recorded tests.</span></div>
      </section>
    </div><BugReportForm onCreated={c => setCases(prev => [c, ...prev])} /></div>
  </div>;
}
