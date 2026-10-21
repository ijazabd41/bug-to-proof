import React, { useState, useEffect, useRef } from "react";
import { API_BASE, artifactUrl } from "../api/client";

interface Answer {
  answer: string;
  mode: string;
  scope: "source" | "documentation";
  abstained?: boolean;
  warnings?: string[];
  telemetry?: { provider: string; strategy: string; retrievalMs: number; cacheHit: boolean };
  sources: { source: string; sourceType: "source" | "test" | "documentation"; chunkId: string; content: string; score: number; startLine?: number; endLine?: number }[];
}

interface DebugReport {
  outcome: string;
  report: string;
  events: string[];
  artifactPath: string;
  patchDiff: string | null;
}

interface RequiredCheck {
  checkId: string;
  name: string;
  type: string;
  command: string;
  passed: boolean;
  durationMs: number;
  output: string;
  artifactPath?: string;
}

interface RepairRun {
  runId: string;
  caseId: string;
  mode: "dynamic" | "simulated";
  state: string;
  attempt?: number;
  maxAttempts?: number;
  diagnostics?: string[];
  originalSourceFingerprint: string;
  proposal?: {
    proposalId: string;
    diagnosis: string;
    assumptions: string[];
    rationale: string;
    unifiedDiff: string;
    proposalHash: string;
    proposedAt: string;
  };
  review?: {
    reviewId: string;
    decision: string;
    reviewedAt: string;
  };
  requiredChecks: RequiredCheck[];
  baselineArtifacts?: { screenshot?: string; trace?: string; resultJson?: string };
  events: { timestamp: string; stage: string; message: string }[];
  stopReason?: string;
  error?: string;
}

export function isTerminalState(state?: string): boolean {
  if (!state) return true;
  return ["AWAITING_REVIEW", "VERIFIED", "BLOCKED", "CANCELLED", "REJECTED", "VERIFICATION_FAILED"].includes(state);
}

export function AIAssistant({ caseId, onComplete }: { caseId: string; onComplete: () => Promise<void> }) {
  const [question, setQuestion] = useState("Why does the cart total show only the first item's price?");
  const [questionScope, setQuestionScope] = useState<"source" | "documentation">("source");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [report, setReport] = useState<DebugReport | null>(null);
  const [repairRun, setRepairRun] = useState<RepairRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ semantic: boolean; embeddingProvider: string; chunks: number } | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch status on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE + "/api/ai/status", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isMountedRef.current) setStatus(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Restore saved repair runs when opening or refreshing a case
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/ai/cases/${caseId}/repair-runs`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((runs: RepairRun[]) => {
        if (isMountedRef.current) {
          if (Array.isArray(runs) && runs.length > 0) {
            setRepairRun(runs[0]);
          } else {
            setRepairRun(null);
          }
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [caseId]);

  // Bounded polling for active running repair state with unmount cleanup
  useEffect(() => {
    if (!repairRun || isTerminalState(repairRun.state)) {
      return;
    }

    const controller = new AbortController();
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/repair-runs/${repairRun.runId}`, {
          signal: controller.signal,
        });
        if (res.ok && isMountedRef.current) {
          const data: RepairRun = await res.json();
          setRepairRun(data);
          if (isTerminalState(data.state)) {
            await onComplete();
          }
        }
      } catch {
        // ignore aborted request
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, [repairRun?.runId, repairRun?.state, onComplete]);

  async function run(url: string, body: unknown, debug = false) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(API_BASE + url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI request failed");
      if (!isMountedRef.current) return;
      if (debug) {
        setReport(data);
        await onComplete();
      } else {
        setAnswer(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  }

  async function startDynamicRepair() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/cases/${caseId}/repair-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dynamic" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start dynamic repair run");
      if (isMountedRef.current) {
        setRepairRun(data);
        await onComplete();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  }

  async function cancelRepairRunAction() {
    if (!repairRun?.runId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/repair-runs/${repairRun.runId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by user via dashboard" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel repair run");
      if (isMountedRef.current) {
        setRepairRun(data);
        await onComplete();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  }

  async function reviewProposal(decision: "APPROVED" | "REJECTED") {
    if (!repairRun?.proposal) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/repair-runs/${repairRun.runId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: repairRun.proposal.proposalId,
          proposalHash: repairRun.proposal.proposalHash,
          decision,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to review proposal");
      if (isMountedRef.current) {
        setRepairRun(data);
        await onComplete();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  }

  const isRunning = Boolean(repairRun && !isTerminalState(repairRun.state));

  return (
    <section className="panel repair-assistant" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
      <span className="eyebrow">REPAIR WORKSPACE</span>
      <h3>Debugging & AI Repair Assistant</h3>
      <p>Ask about source code or run an isolated dynamic AI repair loop with independent verification gates.</p>
      {status && (
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          {status.semantic ? "Semantic retrieval" : "Offline demo retrieval"} · {status.embeddingProvider} · {status.chunks} source chunks
        </p>
      )}

      {/* Dynamic AI Repair Action Section */}
      <div className="repair-start" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 16, margin: "16px 0" }}>
        <h4 style={{ margin: "0 0 8px 0" }}>⚡ Dynamic AI Repair (Isolated Execution)</h4>
        <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px 0" }}>
          Investigates source code dynamically, generates a minimal patch, verifies baseline in an isolated sandbox, and binds exact review approval to independent regression checks.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            disabled={busy || isRunning}
            onClick={startDynamicRepair}
            style={{
              background: "#087f83",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: busy || isRunning ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isRunning ? "Repair Workflow In Progress…" : busy ? "Starting repair…" : "Start Dynamic AI Repair Run"}
          </button>
          {isRunning && (
            <button
              disabled={busy}
              onClick={cancelRepairRunAction}
              style={{
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Cancel Run
            </button>
          )}
        </div>
      </div>

      {/* Active Dynamic Repair Run Details */}
      {repairRun && (
        <div className="repair-run" style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, padding: 16, margin: "16px 0" }}>
          <div className="run-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Repair Run: {repairRun.runId}</h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                Attempt {repairRun.attempt ?? 1} of {repairRun.maxAttempts ?? 3}
              </span>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    repairRun.state === "VERIFIED"
                      ? "#dcfce7"
                      : repairRun.state === "AWAITING_REVIEW"
                      ? "#fef3c7"
                      : repairRun.state === "BLOCKED" || repairRun.state === "VERIFICATION_FAILED" || repairRun.state === "CANCELLED" || repairRun.state === "REJECTED"
                      ? "#fee2e2"
                      : "#e0f2fe",
                  color:
                    repairRun.state === "VERIFIED"
                      ? "#166534"
                      : repairRun.state === "AWAITING_REVIEW"
                      ? "#92400e"
                      : repairRun.state === "BLOCKED" || repairRun.state === "VERIFICATION_FAILED" || repairRun.state === "CANCELLED" || repairRun.state === "REJECTED"
                      ? "#991b1b"
                      : "#075985",
                }}
              >
                {repairRun.state.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {repairRun.diagnostics && repairRun.diagnostics.length > 0 && (
            <div style={{ marginTop: 8, marginBottom: 8, padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 4 }}>
              <strong style={{ fontSize: 12, color: "#92400e" }}>Previous Attempt Diagnostics & Feedback:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: 12, color: "#78350f" }}>
                {repairRun.diagnostics.map((diag, i) => (
                  <li key={i}>{diag}</li>
                ))}
              </ul>
            </div>
          )}

          {repairRun.stopReason && (
            <p style={{ fontSize: 13, color: "#334155", background: "#f1f5f9", padding: 8, borderRadius: 4 }}>
              {repairRun.stopReason}
            </p>
          )}

          {repairRun.baselineArtifacts && (
            <div style={{ marginTop: 12, padding: 12, border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc" }}>
              <h5 style={{ margin: "0 0 8px" }}>Playwright Baseline Evidence</h5>
              {repairRun.baselineArtifacts.screenshot && (
                <a href={artifactUrl(repairRun.baselineArtifacts.screenshot)} target="_blank" rel="noreferrer">
                  <img
                    src={artifactUrl(repairRun.baselineArtifacts.screenshot)}
                    alt="Baseline failure screenshot"
                    style={{ display: "block", width: "100%", maxWidth: 760, maxHeight: 420, objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: 4, background: "#fff" }}
                  />
                </a>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
                {repairRun.baselineArtifacts.trace && <a href={artifactUrl(repairRun.baselineArtifacts.trace)}>Open Playwright trace</a>}
                {repairRun.baselineArtifacts.resultJson && <a href={artifactUrl(repairRun.baselineArtifacts.resultJson)}>Open Playwright report</a>}
              </div>
            </div>
          )}

          {/* Proposal Review Section */}
          {repairRun.proposal && (
            <div style={{ marginTop: 12 }}>
              <h5>Diagnosis & Proposal</h5>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                <strong>Diagnosis:</strong> {repairRun.proposal.diagnosis}
              </p>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                <strong>Rationale:</strong> {repairRun.proposal.rationale}
              </p>
              <p style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                Proposal Hash: {repairRun.proposal.proposalHash}
              </p>

              {repairRun.proposal.unifiedDiff && (
                <pre
                  style={{
                    background: "#0f172a",
                    color: "#f8fafc",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {repairRun.proposal.unifiedDiff}
                </pre>
              )}

              {repairRun.state === "AWAITING_REVIEW" && (
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button
                    disabled={busy}
                    onClick={() => reviewProposal("APPROVED")}
                    style={{
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Approve & Apply Exact Patch
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => reviewProposal("REJECTED")}
                    style={{
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Reject Patch
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Required Regression Checks Breakdown */}
          {repairRun.requiredChecks.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h5>Independent Verification Checks</h5>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {repairRun.requiredChecks.map((check) => (
                  <div
                    key={check.checkId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 4,
                      background: check.passed ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${check.passed ? "#bbf7d0" : "#fecaca"}`,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13 }}>{check.name}</strong>
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>({check.command})</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{check.durationMs}ms</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: check.passed ? "#22c55e" : "#ef4444",
                          color: "#fff",
                        }}
                      >
                        {check.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Log */}
          {repairRun.events.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#475569" }}>
                Execution Event Log ({repairRun.events.length} events)
              </summary>
              <ol style={{ fontSize: 12, color: "#334155", paddingLeft: 20, marginTop: 8 }}>
                {repairRun.events.map((ev, i) => (
                  <li key={i}>
                    <strong>[{ev.stage}]</strong> {ev.message}
                  </li>
                ))}
              </ol>
            </details>
          )}

          {/* Download Proof Bundle Action */}
          <div className="bundle-action" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 13, color: "#1e293b" }}>📦 Verification Proof Bundle</strong>
              <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0 0" }}>
                Download self-contained cryptographic ZIP archive with manifest, hashes, test specs, and markdown proof report.
              </p>
            </div>
            <a
              href={`${API_BASE}/api/ai/repair-runs/${repairRun.runId}/bundle.zip`}
              download={`proof-bundle-${repairRun.caseId}-${repairRun.runId}.zip`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#087f83",
                color: "#ffffff",
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Download Proof Bundle (.zip)
            </a>
          </div>
        </div>
      )}

      {/* RAG Question section */}
      <label htmlFor="rag-question" style={{ marginTop: 16, display: "block" }}>
        {questionScope === "source" ? "Ask a source-code question" : "Ask a project-documentation question"}
      </label>
      <textarea
        id="rag-question"
        value={question}
        maxLength={4000}
        onChange={(e) => setQuestion(e.target.value)}
        style={{ display: "block", width: "100%", minHeight: 70, margin: "8px 0" }}
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="rag-scope" style={{ fontSize: 12, color: "#475569" }}>Search</label>
        <select id="rag-scope" value={questionScope} onChange={event => { setQuestionScope(event.target.value as "source" | "documentation"); setAnswer(null); }}>
          <option value="source">Source code and tests</option>
          <option value="documentation">Project documentation</option>
        </select>
        <button disabled={busy || !question.trim()} onClick={() => run("/api/ai/ask", { question, scope: questionScope })}>
          Ask with sources
        </button>
        <button disabled={busy} onClick={() => run(`/api/ai/cases/${caseId}/debug`, { applyPatch: false }, true)}>
          Legacy reproduce & propose
        </button>
        {report?.outcome === "NEEDS_PATCH_REVIEW" && caseId === "case-001" && (
          <button disabled={busy} onClick={() => run(`/api/ai/cases/${caseId}/debug`, { applyPatch: true }, true)}>
            Apply legacy cart patch & verify
          </button>
        )}
      </div>

      {busy && <p role="status">Executing request…</p>}
      {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
      {answer?.abstained && <p role="status">{answer.answer}</p>}
      {answer?.warnings?.includes("GENERATION_UNAVAILABLE") && (
        <p role="status">Answer generation was unavailable; showing retrieved {answer.scope === "documentation" ? "documentation" : "source"} evidence.</p>
      )}
      {answer?.warnings?.includes("GENERATION_UNGROUNDED") && (
        <p role="status">The generated answer did not pass citation validation; showing retrieved {answer.scope === "documentation" ? "documentation" : "source"} evidence instead.</p>
      )}
      {answer?.telemetry && (
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          {answer.telemetry.strategy} retrieval · {answer.telemetry.retrievalMs} ms ·{" "}
          {answer.telemetry.cacheHit ? "saved index reused" : "index refreshed"}
        </p>
      )}
      {answer && !answer.abstained && (
        <div>
          <p>{answer.mode === "extractive" ? "Local source excerpts" : "Generated answer — check cited sources"}</p>
          {answer.mode === "extractive" ? (
            <p>Retrieved {answer.sources.length} local {answer.scope === "documentation" ? "documentation" : "source-code/test"} excerpts. Expand an excerpt to inspect it.</p>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{answer.answer}</pre>
          )}
          {answer.sources.map((source) => (
            <details key={source.chunkId}>
              <summary>
                {source.sourceType} · {source.source} · lines {source.startLine ?? "?"}–{source.endLine ?? "?"} · {source.chunkId}
              </summary>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{source.content}</pre>
            </details>
          ))}
        </div>
      )}
      {report && (
        <div>
          <h4>{report.outcome.replace(/_/g, " ")}</h4>
          <p>{report.report}</p>
          <ol>
            {report.events.map((event, index) => (
              <li key={index}>{event}</li>
            ))}
          </ol>
          {report.patchDiff && <pre style={{ whiteSpace: "pre-wrap" }}>{report.patchDiff}</pre>}
          <a href={artifactUrl(report.artifactPath)}>Recorded agent report</a>
        </div>
      )}
    </section>
  );
}
