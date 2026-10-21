import React from "react";
import type { Patch } from "../types";

interface PatchViewerProps {
  patch: Patch;
}

function classifyDiffLine(line: string): { color: string; bg?: string; borderLeft?: string } {
  // File headers (--- a/... and +++ b/...)
  if (line.startsWith("---") || line.startsWith("+++")) {
    return { color: "#64748b", bg: "#f1f5f9" };
  }
  // Hunk headers
  if (line.startsWith("@@")) {
    return { color: "#0369a1", bg: "#f0f9ff", borderLeft: "2px solid #0284c7" };
  }
  // Additions
  if (line.startsWith("+")) {
    return { color: "#15803d", bg: "#f0fdf4", borderLeft: "2px solid #16a34a" };
  }
  // Removals
  if (line.startsWith("-")) {
    return { color: "#b91c1c", bg: "#fef2f2", borderLeft: "2px solid #dc2626" };
  }
  // Context lines
  return { color: "#334155" };
}

export function PatchViewer({ patch }: PatchViewerProps) {
  const hasDiff = typeof patch.diff === "string" && patch.diff.trim().length > 0;
  const lines = hasDiff ? patch.diff.split("\n") : [];

  return (
    <div className="patch-viewer-container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Patch status badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          className="patch-status-badge"
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 9999,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
            background: patch.status === "APPLIED" ? "#ecfdf5" : "#fffbeb",
            color: patch.status === "APPLIED" ? "#047857" : "#b45309",
            border: `1px solid ${patch.status === "APPLIED" ? "#a7f3d0" : "#fde68a"}`,
          }}
        >
          {patch.status === "APPLIED" ? "✓ Applied" : "○ Proposed"}
        </span>
        {patch.appliedAt && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Applied {new Date(patch.appliedAt).toLocaleString()}
          </span>
        )}
        {!patch.appliedAt && patch.proposedAt && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Proposed {new Date(patch.proposedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Summary */}
      {patch.summary ? (
        <div className="patch-summary-box">
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Summary
          </p>
          <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6 }}>{patch.summary}</p>
        </div>
      ) : null}

      {/* Reasoning */}
      {patch.reasoning ? (
        <div className="patch-reasoning-box">
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Reasoning
          </p>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{patch.reasoning}</p>
        </div>
      ) : null}

      {/* Files changed */}
      {patch.filesChanged.length > 0 && (
        <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ color: "#0f172a" }}>Files changed:</strong>
          {patch.filesChanged.map((file) => (
            <code
              key={file}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#0369a1",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {file}
            </code>
          ))}
        </div>
      )}

      {/* Diff */}
      <div className="diff-view-card">
        <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Unified Diff
        </p>
        {hasDiff ? (
          <pre
            className="unified-diff-pre"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "14px 0",
              overflowX: "auto",
              fontSize: 12,
              lineHeight: 1.65,
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
              whiteSpace: "pre",
              tabSize: 4,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
            }}
            role="region"
            aria-label="Unified diff"
          >
            {lines.map((line, i) => {
              const { color, bg, borderLeft } = classifyDiffLine(line);
              return (
                <div
                  key={i}
                  style={{
                    color,
                    background: bg ?? "transparent",
                    borderLeft: borderLeft ?? "2px solid transparent",
                    padding: "1px 16px",
                    display: "flex",
                    minWidth: "fit-content",
                  }}
                >
                  <span
                    style={{
                      userSelect: "none",
                      width: 36,
                      flexShrink: 0,
                      color: "#94a3b8",
                      fontSize: 10,
                      textAlign: "right",
                      paddingRight: 14,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{line || "\u00a0"}</span>
                </div>
              );
            })}
          </pre>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No diff available.</p>
        )}
      </div>

      {/* Helper text */}
      <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        ℹ️ This diff shows the proposed code change. Marking as Applied records that a developer
        applied the patch to MiniShop. It does not automatically modify the MiniShop source code
        or any Git branches.
      </p>
    </div>
  );
}
