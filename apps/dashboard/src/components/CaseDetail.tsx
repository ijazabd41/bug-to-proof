import React, { useEffect, useRef, useState } from "react";
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

const POLLING_STATUSES = ["REPRODUCING", "VERIFYING"];

export function CaseDetail({ bugCase, onUpdate }: CaseDetailProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling while running ──────────────────────────────────────────────────
  useEffect(() => {
    if (POLLING_STATUSES.includes(bugCase.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const fresh = await api.getCase(bugCase.id);
          onUpdate(fresh);
          if (!POLLING_STATUSES.includes(fresh.status)) {
            clearInterval(pollRef.current!);
          }
        } catch {
          // silent
        }
      }, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bugCase.status, bugCase.id, onUpdate]);

  const doAction = async (fn: () => Promise<unknown>, successRefresh = true) => {
    setActionError(null);
    setActionLoading(true);
    try {
      await fn();
      if (successRefresh) {
        const fresh = await api.getCase(bugCase.id);
        onUpdate(fresh);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{bugCase.title}</h2>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            {bugCase.id} · Created {new Date(bugCase.createdAt).toLocaleString()}
          </p>
          <p style={{ marginTop: 10, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
            {bugCase.description}
          </p>
        </div>
        <StatusBadge status={bugCase.status} />
      </div>

      {actionError && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {actionError}
        </div>
      )}

      {/* Root Cause */}
      {bugCase.rootCauseExplanation && section(
        "Root Cause Analysis",
        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, background: "#f7f8fa", padding: 12, borderRadius: 6 }}>
          {bugCase.rootCauseExplanation}
        </p>
      )}

      {/* Reproduction */}
      {section(
        "Reproduction",
        <>
          {bugCase.reproduction ? (
            <>
              {bugCase.reproduction.preconditions.length > 0 && (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Preconditions</p>
                  <ul style={{ paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                    {bugCase.reproduction.preconditions.map((p, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Steps</p>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                  {bugCase.reproduction.steps.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                  ))}
                </ol>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>Expected</p>
                  <p style={{ fontSize: 13, color: "#374151" }}>{bugCase.reproduction.expected || "—"}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", marginBottom: 4 }}>Actual</p>
                  <p style={{ fontSize: 13, color: "#374151" }}>{bugCase.reproduction.actual || "—"}</p>
                </div>
              </div>
              {bugCase.reproduction.lastRun && (
                <div
                  style={{
                    background: bugCase.reproduction.lastRun.passed ? "#dcfce7" : "#fee2e2",
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  Last run: {bugCase.reproduction.lastRun.passed ? "✅ PASSED" : "❌ FAILED"} —{" "}
                  {bugCase.reproduction.lastRun.durationMs}ms at{" "}
                  {new Date(bugCase.reproduction.lastRun.runAt).toLocaleString()}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>No reproduction info yet.</p>
          )}

          {/* Run Reproduction button */}
          {(bugCase.status === "READY_TO_REPRODUCE" || bugCase.status === "REPRODUCED") && (
            <button
              disabled={actionLoading}
              onClick={() => doAction(() => api.reproduce(bugCase.id), false)}
              style={btnStyle("#3b82f6", actionLoading)}
            >
              {actionLoading ? "Starting…" : "▶ Run Reproduction"}
            </button>
          )}

          {/* Evidence from before run */}
          {bugCase.evidence.some((e) => e.phase === "before") && (
            <EvidencePanel evidence={bugCase.evidence} phase="before" title="Before Evidence" />
          )}
        </>
      )}

      {/* Patch */}
      {bugCase.patch && section(
        "Proposed Patch",
        <>
          <PatchViewer patch={bugCase.patch} />

          {/* Mark as Applied */}
          {bugCase.status === "PATCH_PROPOSED" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                doAction(() =>
                  api.updateCase(bugCase.id, {
                    status: "PATCH_APPLIED",
                    patch: { ...bugCase.patch!, status: "APPLIED", appliedAt: new Date().toISOString() },
                  })
                )
              }
              style={btnStyle("#10b981", actionLoading)}
            >
              {actionLoading ? "Updating…" : "✓ Mark as Applied"}
            </button>
          )}

          {/* Run Verification */}
          {bugCase.status === "PATCH_APPLIED" && (
            <button
              disabled={actionLoading}
              onClick={() => doAction(() => api.verify(bugCase.id), false)}
              style={btnStyle("#7c3aed", actionLoading)}
            >
              {actionLoading ? "Starting…" : "▶ Run Verification"}
            </button>
          )}
        </>
      )}

      {/* Before/After Comparison */}
      {bugCase.evidence.some((e) => e.phase === "after") && section(
        "Before / After Comparison",
        <BeforeAfterComparison evidence={bugCase.evidence} />
      )}

      {/* Verification result */}
      {bugCase.verification?.comparison && section(
        "Verification Result",
        <div
          style={{
            background: bugCase.status === "VERIFIED" ? "#dcfce7" : "#fee2e2",
            padding: 14,
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          {bugCase.status === "VERIFIED"
            ? "✅ Test passed after patch — bug is fixed!"
            : "❌ Test still failing after patch — patch did not fix the bug."}
          {bugCase.verification.afterRun && (
            <p style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              After run: {bugCase.verification.afterRun.durationMs}ms ·{" "}
              {new Date(bugCase.verification.afterRun.runAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
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
