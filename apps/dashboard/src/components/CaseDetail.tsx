import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BugCase } from "../types";
import { api } from "../api/client";
import { StatusBadge } from "./StatusBadge";
import { PatchViewer } from "./PatchViewer";
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import { AIAssistant } from "./AIAssistant";
import { EvidencePanel } from "./EvidencePanel";
import { Workflow } from "./Workflow";
import { ReportClarification } from "./ReportClarification";
import type { ReproductionRunRecordSummary } from "../types/reproduction";

interface CaseDetailProps {
  bugCase: BugCase;
  onUpdate: (updated: BugCase) => void;
}

const POLLING_STATUSES = new Set(["REPRODUCING", "VERIFYING"]);
const DEMO_CASE_ID = "case-001";
const REPRODUCTION_STATE_STYLE: Record<string, { background: string; color: string }> = {
  DISCOVERING_TARGET: { background: "#e0f2fe", color: "#0369a1" },
  GENERATING_CANDIDATE: { background: "#dbeafe", color: "#1d4ed8" },
  CANDIDATE_INVALID: { background: "#ffedd5", color: "#9a3412" },
  CANDIDATE_EXECUTION_ERROR: { background: "#fee2e2", color: "#991b1b" },
  BASELINE_PASSED: { background: "#dcfce7", color: "#166534" },
  BLOCKED: { background: "#f3e8ff", color: "#7e22ce" },
  CANCELLED: { background: "#e5e7eb", color: "#374151" },
  AWAITING_TEST_REVIEW: { background: "#fef3c7", color: "#92400e" },
};

export function CaseDetail({ bugCase, onUpdate }: CaseDetailProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reproductionRun, setReproductionRun] = useState<ReproductionRunRecordSummary | null>(null);
  const [reproductionLoading, setReproductionLoading] = useState(false);
  const [reproductionError, setReproductionError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const hasTrustedReproductionTest = Boolean(bugCase.reproduction?.testFile?.trim());

  useEffect(() => {
    let cancelled = false;
    setReproductionRun(null);
    setReproductionError(null);
    if (!hasTrustedReproductionTest && bugCase.reportCompleteness?.complete) {
      void api.listReproductionRuns(bugCase.id).then(runs => {
        if (!cancelled) setReproductionRun(runs?.[0] ?? null);
      }).catch(error => {
        if (!cancelled) setReproductionError(error instanceof Error ? error.message : String(error));
      });
    }
    return () => { cancelled = true; };
  }, [bugCase.id, hasTrustedReproductionTest, bugCase.reportCompleteness?.complete]);

  useEffect(() => {
    if (!reproductionRun) return;
    const active = ["DISCOVERING_TARGET", "GENERATING_CANDIDATE"].includes(reproductionRun.state);
    if (!active) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await api.getReproductionRun(reproductionRun.reproductionRunId);
        if (fresh) { setReproductionRun(fresh); setReproductionError(null); }
      } catch (error) {
        setReproductionError(error instanceof Error ? error.message : String(error));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [bugCase.id, reproductionRun?.reproductionRunId, reproductionRun?.state]);

  const handleStartReproduction = async () => {
    setReproductionLoading(true);
    setReproductionError(null);
    try {
      const res = await api.startReproductionRun(bugCase.id);
      if (res?.reproductionRunId) {
        const fresh = await api.getReproductionRun(res.reproductionRunId);
        if (fresh) setReproductionRun(fresh);
      }
    } catch (err) {
      setReproductionError(err instanceof Error ? err.message : String(err));
    } finally {
      setReproductionLoading(false);
    }
  };

  const handleCancelReproduction = async () => {
    if (!reproductionRun) return;
    try {
      await api.cancelReproductionRun(reproductionRun.reproductionRunId);
      const fresh = await api.getReproductionRun(reproductionRun.reproductionRunId);
      if (fresh) setReproductionRun(fresh);
    } catch (err) {
      setReproductionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReviewReproduction = async (decision: "APPROVE" | "REJECT") => {
    if (!reproductionRun) return;
    const candidate = [...(reproductionRun.attempts ?? [])].reverse().find(attempt => attempt.classification === "ASSERTION_FAILED");
    if (!candidate?.definitionHash || !candidate.compiledTestHash) { setReproductionError("The reviewable candidate hashes are unavailable."); return; }
    setReviewLoading(decision); setReproductionError(null);
    try {
      const reviewed = await api.reviewReproductionRun(reproductionRun.reproductionRunId, { decision,
        definitionHash: candidate.definitionHash, compiledTestHash: candidate.compiledTestHash,
        acceptedBy: "dashboard-reviewer", reviewerNotes: reviewerNotes.trim() || undefined });
      setReproductionRun(reviewed);
      const fresh = await api.getCase(bugCase.id); onUpdate(fresh);
    } catch (error) { setReproductionError(error instanceof Error ? error.message : String(error)); }
    finally { setReviewLoading(null); }
  };

  // Use a ref for polling so we don't stale-close over the current case id
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const currentCaseIdRef = useRef(bugCase.id);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep ref current with the case ID
  useEffect(() => {
    currentCaseIdRef.current = bugCase.id;
  }, [bugCase.id]);

  // ── Polling via setTimeout chain (no overlapping requests) ────────────────────
  const schedulePoll = useCallback(
    (caseId: string) => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        if (currentCaseIdRef.current !== caseId) return; // different case loaded
        try {
          const fresh = await api.getCase(caseId);
          if (!isMountedRef.current || currentCaseIdRef.current !== caseId) return;
          setPollingError(null);
          onUpdate(fresh);
          // Keep polling while still in a running state
          if (POLLING_STATUSES.has(fresh.status)) {
            schedulePoll(caseId);
          }
        } catch (err) {
          if (!isMountedRef.current || currentCaseIdRef.current !== caseId) return;
          // Retain last known data — show recoverable error
          setPollingError(
            err instanceof Error ? err.message : "Polling failed — retrying…"
          );
          // Retry after a slightly longer delay on error
          if (POLLING_STATUSES.has(bugCase.status)) {
            pollTimeoutRef.current = setTimeout(() => schedulePoll(caseId), 4000);
          }
        }
      }, 2000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onUpdate]
  );

  useEffect(() => {
    if (POLLING_STATUSES.has(bugCase.status)) {
      schedulePoll(bugCase.id);
    } else {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    }
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [bugCase.status, bugCase.id, schedulePoll]);

  // ── Manual refresh ────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      const fresh = await api.getCase(bugCase.id);
      onUpdate(fresh);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // ── Generic action wrapper ────────────────────────────────────────────────────
  const doAction = async (
    fn: () => Promise<unknown>,
    opts: { refreshAfter?: boolean; startPolling?: boolean } = {}
  ) => {
    const { refreshAfter = true, startPolling = false } = opts;
    setActionError(null);
    setActionLoading(true);
    try {
      await fn();
      if (startPolling) {
        // 202 accepted — start polling immediately
        schedulePoll(bugCase.id);
        return;
      }
      if (refreshAfter) {
        const fresh = await api.getCase(bugCase.id);
        onUpdate(fresh);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      setActionError(msg);
      // On 409, refresh to get the current actual state
      if (err instanceof Error && (err as Error & { status?: number }).status === 409) {
        try {
          const fresh = await api.getCase(bugCase.id);
          onUpdate(fresh);
        } catch {
          // ignore secondary error
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Demo Reset (only for case-001) ────────────────────────────────────────────
  const handleDemoReset = async () => {
    setResetting(true);
    setActionError(null);
    try {
      const reset = await api.demoReset();
      if (reset) onUpdate(reset);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Demo reset failed");
    } finally {
      setResetting(false);
    }
  };

  // ── Section wrapper ───────────────────────────────────────────────────────────
  const section = (title: string, children: React.ReactNode) => (
    <section
      className={`panel detail-section section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 20,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{title}</h3>
      {children}
    </section>
  );

  const isRunning = POLLING_STATUSES.has(bugCase.status);

  return (
    <div className="detail-grid">
      {/* ── Header ── */}
      <div
        className="case-header"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 6,
                wordBreak: "break-word",
              }}
            >
              {bugCase.title}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280" }}>
              {bugCase.id} · Created{" "}
              {new Date(bugCase.createdAt).toLocaleString()} · Updated{" "}
              {new Date(bugCase.updatedAt).toLocaleString()}
            </p>
            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "#374151",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {bugCase.description}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <StatusBadge status={bugCase.status} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleRefresh}
                disabled={refreshing || isRunning}
                aria-label="Refresh case data"
                title="Refresh case data from the server"
                style={{
                  padding: "5px 12px",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  cursor: refreshing ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {refreshing ? "…" : "↺ Refresh"}
              </button>
              {/* Demo Reset button — only visible on the demo case */}
              {bugCase.id === DEMO_CASE_ID && (
                <button
                  onClick={handleDemoReset}
                  disabled={resetting || isRunning}
                  title="Reset case-001 to its seed state (REPRODUCED + patch PROPOSED). Resets case data only — does not modify MiniShop source code, Git branches, or committed artifacts."
                  style={{
                    padding: "5px 12px",
                    background: resetting ? "#d1d5db" : "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 6,
                    cursor: resetting ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#c2410c",
                  }}
                >
                  {resetting ? "Resetting…" : "↺ Demo Reset"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Demo Reset helper text */}
        {bugCase.id === DEMO_CASE_ID && (
          <p
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "#9ca3af",
              lineHeight: 1.5,
            }}
          >
            ℹ️ Demo Reset restores case-001 to the seeded REPRODUCED state so the demo can be
            repeated. It resets case data only — it does not modify MiniShop source code, Git
            branches, or any committed artifacts.
          </p>
        )}
      </div>

      <Workflow status={bugCase.status} />

      <div className="case-layout">
      <div className="case-content">
      <section className="panel verification-overview" aria-labelledby="verification-heading">
        <div className="panel-heading"><div><span className="eyebrow">THE EVIDENCE</span><h3 id="verification-heading">Before / After Comparison</h3></div></div>
        <p className="panel-description">Recorded results from the original and patched application.</p>
        <BeforeAfterComparison evidence={bugCase.evidence} verification={bugCase.verification} />
      </section>

      {/* ── Errors ── */}
      {actionError && (
        <div
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid #fecaca",
          }}
        >
          {actionError}
        </div>
      )}

      {pollingError && (
        <div
          role="status"
          style={{
            background: "#fff7ed",
            color: "#c2410c",
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 12,
            border: "1px solid #fed7aa",
          }}
        >
          ⚠️ {pollingError} — last known state shown above.
        </div>
      )}

      {/* ── Running indicator ── */}
      {isRunning && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3b82f6",
              animation: "btp-pulse 1.2s ease-in-out infinite",
            }}
          />
          {bugCase.status === "REPRODUCING"
            ? "Reproduction in progress — polling for results…"
            : "Verification in progress — polling for results…"}
        </div>
      )}

      {/* ── Failure cards ── */}
      {bugCase.status === "REPRODUCTION_FAILED" && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <p style={{ fontWeight: 700, color: "#c2410c", marginBottom: 4 }}>
            ⚠️ Reproduction Failed
          </p>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            The Playwright test runner could not reproduce the bug. This may indicate a
            MiniShop connectivity issue, an infrastructure error, or that the test is not
            applicable to the current environment. Check that MiniShop is running on port 5174
            and retry reproduction.
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            A passing baseline or an infrastructure error cannot establish the reported bug.
          </p>
        </div>
      )}

      {bugCase.status === "VERIFICATION_FAILED" && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <p style={{ fontWeight: 700, color: "#c2410c", marginBottom: 4 }}>
            ⚠️ Verification Failed
          </p>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            The Playwright test still failed after the patch was applied. Either the patch does
            not fully fix the bug, MiniShop is not running the patched version, or the runner
            encountered an infrastructure error.
          </p>
        </div>
      )}

      {/* ── Root Cause ── */}
      {bugCase.rootCauseExplanation
        ? section(
            "Root Cause Analysis",
            <p
              style={{
                fontSize: 14,
                color: "#374151",
                lineHeight: 1.7,
                background: "#f7f8fa",
                padding: 12,
                borderRadius: 6,
              }}
            >
              {bugCase.rootCauseExplanation}
            </p>
          )
        : null}

      {/* ── Reproduction ── */}
      {section(
        "Reproduction",
        <>
          {bugCase.reproduction ? (
            <>
              {Array.isArray(bugCase.reproduction.preconditions) && bugCase.reproduction.preconditions.length > 0 && (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Preconditions
                  </p>
                  <ul
                    style={{ paddingLeft: 20, fontSize: 13, color: "#374151" }}
                  >
                    {bugCase.reproduction.preconditions.map((p, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(bugCase.reproduction.steps) && bugCase.reproduction.steps.length > 0 && (<div>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Steps</p>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                  {bugCase.reproduction.steps.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>)}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#15803d",
                      marginBottom: 4,
                    }}
                  >
                    Expected
                  </p>
                  <p style={{ fontSize: 13, color: "#374151" }}>
                    {bugCase.reproduction.expected || "—"}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#b91c1c",
                      marginBottom: 4,
                    }}
                  >
                    Actual
                  </p>
                  <p style={{ fontSize: 13, color: "#374151" }}>
                    {bugCase.reproduction.actual || "—"}
                  </p>
                </div>
              </div>
              {bugCase.reproduction.lastRun?.outcome === "INFRASTRUCTURE_ERROR" && (
                <p role="alert">Infrastructure error — no reproduced bug. {bugCase.reproduction.lastRun.actual}</p>
              )}
              {bugCase.reproduction.lastRun != null && (
                <div
                  style={{
                    background: bugCase.reproduction.lastRun.passed
                      ? "#dcfce7"
                      : "#fee2e2",
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  Last run:{" "}
                  {bugCase.reproduction.lastRun.passed ? "✅ PASSED" : "❌ FAILED"} —{" "}
                  {bugCase.reproduction.lastRun.durationMs}ms at{" "}
                  {new Date(bugCase.reproduction.lastRun.runAt).toLocaleString()}
                  {bugCase.reproduction.lastRun.outcome === "ASSERTION_FAILED" && (
                    <p style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                      Bug reproduced — baseline test failed as expected.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>
              No reproduction info yet.
            </p>
          )}

          {!hasTrustedReproductionTest && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bugCase.reportCompleteness && !bugCase.reportCompleteness.complete ? (
                <>
                  <div role="status" style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "10px 14px", color: "#9a3412", fontSize: 13 }}>
                    More report details are required: {bugCase.reportCompleteness.missingFields.join(", ")}.
                  </div>
                  <ReportClarification bugCase={bugCase} onUpdate={onUpdate} />
                </>
              ) : (
                <>
                  {reproductionRun && (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                          Reproduction Run: <code style={{ fontSize: 11 }}>{reproductionRun.reproductionRunId}</code>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4, ...(REPRODUCTION_STATE_STYLE[reproductionRun.state] ?? { background: "#e2e8f0", color: "#334155" }) }}>
                          {reproductionRun.state}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#334155", marginBottom: 6 }}>
                        {reproductionRun.events?.[reproductionRun.events.length - 1]?.message || reproductionRun.stopReason || "Orchestrating reproduction generation…"}
                      </p>
                      {reproductionRun.attempts?.length > 0 && (
                        <p style={{ fontSize: 12, color: "#64748b" }}>
                          Attempts: {reproductionRun.attempts.length}
                          {reproductionRun.attempts[reproductionRun.attempts.length - 1]?.diagnostics && ` — ${reproductionRun.attempts[reproductionRun.attempts.length - 1]?.diagnostics}`}
                        </p>
                      )}
                      {["DISCOVERING_TARGET", "GENERATING_CANDIDATE"].includes(reproductionRun.state) && (
                        <button
                          onClick={handleCancelReproduction}
                          style={{ marginTop: 8, padding: "4px 10px", fontSize: 12, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", color: "#b91c1c" }}
                        >
                          Cancel Generation
                        </button>
                      )}
                      {reproductionRun.state === "AWAITING_TEST_REVIEW" && (
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          <p style={{ fontSize: 12, color: "#854d0e" }}>Review the report mapping and assertion evidence. Approval is bound to the displayed definition and compiled-test hashes, then reruns frozen bytes on unchanged source.</p>
                          <code style={{ fontSize: 10, color: "#64748b", overflowWrap: "anywhere" }}>Definition: {reproductionRun.attempts[reproductionRun.attempts.length - 1]?.definitionHash}<br />Compiled test: {reproductionRun.attempts[reproductionRun.attempts.length - 1]?.compiledTestHash}</code>
                          <textarea aria-label="Reviewer notes" value={reviewerNotes} onChange={event => setReviewerNotes(event.target.value)} maxLength={2000} placeholder="Optional review notes" style={{ minHeight: 58, padding: 8, border: "1px solid #cbd5e1", borderRadius: 5 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button disabled={reviewLoading !== null} onClick={() => handleReviewReproduction("APPROVE")} style={btnStyle("#166534", reviewLoading !== null)}>{reviewLoading === "APPROVE" ? "Confirming…" : "Approve & Confirm Baseline"}</button>
                            <button disabled={reviewLoading !== null} onClick={() => handleReviewReproduction("REJECT")} style={btnStyle("#b91c1c", reviewLoading !== null)}>{reviewLoading === "REJECT" ? "Rejecting…" : "Reject Candidate"}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {reproductionError && (
                    <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
                      {reproductionError}
                    </p>
                  )}

                  {(!reproductionRun || !["DISCOVERING_TARGET", "GENERATING_CANDIDATE"].includes(reproductionRun.state)) && (
                    <button
                      disabled={reproductionLoading}
                      onClick={handleStartReproduction}
                      style={btnStyle("#2563eb", reproductionLoading)}
                    >
                      {reproductionLoading ? "Starting…" : "▶ Generate Reproduction"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* REPORTED configured cases may start the existing runner. */}
          {bugCase.status === "REPORTED" && hasTrustedReproductionTest && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() =>
                  api.reproduce(bugCase.id)
                )
              }
              style={btnStyle("#6b7280", actionLoading)}
            >
              {actionLoading ? "Updating…" : "→ Mark as Ready to Reproduce"}
            </button>
          )}

          {/* READY_TO_REPRODUCE: run reproduction */}
          {bugCase.status === "READY_TO_REPRODUCE" && hasTrustedReproductionTest && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() => api.reproduce(bugCase.id), {
                  refreshAfter: false,
                  startPolling: true,
                })
              }
              style={btnStyle("#3b82f6", actionLoading)}
            >
              {actionLoading ? "Starting…" : "▶ Run Reproduction"}
            </button>
          )}

          {/* REPRODUCED: re-run reproduction (the runner accepts re-runs) */}
          {bugCase.status === "REPRODUCED" && hasTrustedReproductionTest && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() => api.reproduce(bugCase.id), {
                  refreshAfter: false,
                  startPolling: true,
                })
              }
              style={btnStyle("#3b82f6", actionLoading)}
            >
              {actionLoading ? "Starting…" : "▶ Re-run Reproduction"}
            </button>
          )}

          {/* REPRODUCTION_FAILED: allow retry via READY_TO_REPRODUCE */}
          {bugCase.status === "REPRODUCTION_FAILED" && hasTrustedReproductionTest && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() =>
                  api.reproduce(bugCase.id)
                )
              }
              style={btnStyle("#f59e0b", actionLoading)}
            >
              {actionLoading ? "Updating…" : "↺ Retry reproduction"}
            </button>
          )}

          {/* Evidence from before run */}
          {bugCase.evidence.some((e) => e.phase === "before") && (
            <EvidencePanel
              evidence={bugCase.evidence}
              phase="before"
              title="Before Evidence"
              run={bugCase.reproduction?.lastRun ?? null}
            />
          )}
        </>
      )}

      {/* ── Patch ── */}
      {bugCase.patch
        ? section(
            "Proposed Patch",
            <>
              <PatchViewer patch={bugCase.patch} />

              {/* REPRODUCED → PATCH_PROPOSED: accept the proposed patch to advance state machine */}
              {bugCase.status === "REPRODUCED" && bugCase.patch.status === "PROPOSED" && (
                <div
                  style={{
                    background: "#f7f8fa",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#374151" }}>
                    A patch has been proposed. Accept it to advance the case to the Patch
                    Proposed state, then mark it as applied once the fix is applied to MiniShop.
                  </p>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      doAction(() =>
                        api.updateCase(bugCase.id, { status: "PATCH_PROPOSED" })
                      )
                    }
                    style={btnStyle("#7c5cd8", actionLoading)}
                  >
                    {actionLoading ? "Updating…" : "✓ Accept Proposed Patch"}
                  </button>
                </div>
              )}

              {/* PATCH_PROPOSED: mark as applied */}
              {bugCase.status === "PATCH_PROPOSED" && (
                <div
                  style={{
                    background: "#f7f8fa",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#374151" }}>
                    Mark this patch as applied once you have manually applied the diff to
                    MiniShop. This records the application — it does not automatically modify any
                    source files or Git branches.
                  </p>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      doAction(() =>
                        api.updateCase(bugCase.id, {
                          status: "PATCH_APPLIED",
                          patch: {
                            ...bugCase.patch!,
                            status: "APPLIED",
                            appliedAt: new Date().toISOString(),
                          },
                        })
                      )
                    }
                    style={btnStyle("#10b981", actionLoading)}
                  >
                    {actionLoading ? "Updating…" : "✓ Mark as Applied"}
                  </button>
                </div>
              )}

              {/* PATCH_APPLIED: run verification */}
              {bugCase.status === "PATCH_APPLIED" && (
                <div
                  style={{
                    background: "#f7f8fa",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#374151" }}>
                    Patch has been applied. Run verification to confirm the bug is fixed on the
                    patched MiniShop (must be running on port 5174 with the patch applied).
                  </p>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      doAction(() => api.verify(bugCase.id), {
                        refreshAfter: false,
                        startPolling: true,
                      })
                    }
                    style={btnStyle("#7c3aed", actionLoading)}
                  >
                    {actionLoading ? "Starting…" : "▶ Run Verification"}
                  </button>
                </div>
              )}
            </>
          )
        : null}

      {/* ── Verification result ── */}
      {bugCase.verification?.comparison
        ? section(
            "Verification Result",
            <>
              <div
                style={{
                  background:
                    bugCase.status === "VERIFIED" ? "#dcfce7" : "#fff7ed",
                  padding: 14,
                  borderRadius: 6,
                  fontSize: 14,
                  border:
                    bugCase.status === "VERIFIED"
                      ? "1px solid #bbf7d0"
                      : "1px solid #fed7aa",
                }}
              >
                {bugCase.status === "VERIFIED" ? (
                  <>
                    ✅ <strong>Test passed after patch — bug is fixed!</strong>
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Test still failing after patch</strong> — the patch may not
                    fully address the bug or MiniShop is not running the patched version.
                  </>
                )}
                {bugCase.verification.afterRun != null && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    After run: {bugCase.verification.afterRun.durationMs}ms ·{" "}
                    {new Date(bugCase.verification.afterRun.runAt).toLocaleString()}
                  </p>
                )}
              </div>
            </>
          )
        : null}

      </div>
      <AIAssistant key={bugCase.id} caseId={bugCase.id} onComplete={handleRefresh} />
      </div>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    alignSelf: "flex-start",
    padding: "8px 20px",
    background: disabled ? "#d1d5db" : bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 14,
  };
}
