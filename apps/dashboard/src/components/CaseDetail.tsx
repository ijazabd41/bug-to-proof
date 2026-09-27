import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BugCase } from "../types";
import { api } from "../api/client";
import { StatusBadge } from "./StatusBadge";
import { PatchViewer } from "./PatchViewer";
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import { EvidencePanel } from "./EvidencePanel";

interface CaseDetailProps {
  bugCase: BugCase;
  onUpdate: (updated: BugCase) => void;
}

const POLLING_STATUSES = new Set(["REPRODUCING", "VERIFYING"]);
const DEMO_CASE_ID = "case-001";

export function CaseDetail({ bugCase, onUpdate }: CaseDetailProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Header ── */}
      <div
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
                fontSize: 20,
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
            Note: REPRODUCTION_FAILED means the runner encountered an error, not that the bug
            doesn't exist.
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
              {bugCase.reproduction.preconditions.length > 0 && (
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
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Steps</p>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                  {bugCase.reproduction.steps.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
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
                  {!bugCase.reproduction.lastRun.passed && (
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

          {/* REPORTED: offer to mark as ready before running */}
          {bugCase.status === "REPORTED" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() =>
                  api.updateCase(bugCase.id, { status: "READY_TO_REPRODUCE" })
                )
              }
              style={btnStyle("#6b7280", actionLoading)}
            >
              {actionLoading ? "Updating…" : "→ Mark as Ready to Reproduce"}
            </button>
          )}

          {/* READY_TO_REPRODUCE: run reproduction */}
          {bugCase.status === "READY_TO_REPRODUCE" && (
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
          {bugCase.status === "REPRODUCED" && (
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
          {bugCase.status === "REPRODUCTION_FAILED" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() =>
                  api.updateCase(bugCase.id, { status: "READY_TO_REPRODUCE" })
                )
              }
              style={btnStyle("#f59e0b", actionLoading)}
            >
              {actionLoading ? "Updating…" : "↺ Reset to Ready (retry reproduction)"}
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

      {/* ── Before / After Comparison ── */}
      {(bugCase.evidence.some((e) => e.phase === "before") ||
        bugCase.evidence.some((e) => e.phase === "after"))
        ? section(
            "Before / After Comparison",
            <BeforeAfterComparison
              evidence={bugCase.evidence}
              verification={bugCase.verification}
            />
          )
        : null}
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
