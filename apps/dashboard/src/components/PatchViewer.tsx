import React from "react";
import type { Patch } from "../types";

interface PatchViewerProps {
  patch: Patch;
}

function classifyDiffLine(line: string): { color: string; fontWeight?: string } {
  // File headers (--- a/... and +++ b/...) — do NOT treat as add/remove
  if (line.startsWith("---") || line.startsWith("+++")) {
    return { color: "#8b949e" };
  }
  // Hunk headers
  if (line.startsWith("@@")) {
    return { color: "#79c0ff" };
  }
  // Additions
  if (line.startsWith("+")) {
    return { color: "#3fb950" };
  }
  // Removals
  if (line.startsWith("-")) {
    return { color: "#f85149" };
  }
  // Context lines / diff metadata (index, diff --git, etc.)
  return { color: "#8b949e" };
}

export function PatchViewer({ patch }: PatchViewerProps) {
  const hasDiff = typeof patch.diff === "string" && patch.diff.trim().length > 0;
  const lines = hasDiff ? patch.diff.split("\n") : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Patch status badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 9999,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: patch.status === "APPLIED" ? "#dcfce7" : "#fef9c3",
            color: patch.status === "APPLIED" ? "#15803d" : "#854d0e",
          }}
        >
          {patch.status === "APPLIED" ? "✓ Applied" : "○ Proposed"}
        </span>
        {patch.appliedAt && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Applied {new Date(patch.appliedAt).toLocaleString()}
          </span>
        )}
        {!patch.appliedAt && patch.proposedAt && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Proposed {new Date(patch.proposedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Summary */}
      {patch.summary ? (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            Summary
          </p>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{patch.summary}</p>
        </div>
      ) : null}

      {/* Reasoning */}
      {patch.reasoning ? (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            Reasoning
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{patch.reasoning}</p>
        </div>
      ) : null}

      {/* Files changed */}
      {patch.filesChanged.length > 0 && (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          <strong>Files changed:</strong> {patch.filesChanged.join(", ")}
        </div>
      )}

      {/* Diff */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Diff</p>
        {hasDiff ? (
          <pre
            style={{
              background: "#0d1117",
              color: "#c9d1d9",
              padding: 16,
              borderRadius: 6,
              overflowX: "auto",
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, 'Courier New', monospace",
              whiteSpace: "pre",
              tabSize: 4,
            }}
            role="region"
            aria-label="Unified diff"
          >
            {lines.map((line, i) => {
              const { color } = classifyDiffLine(line);
              return (
                <span key={i} style={{ color, display: "block" }}>
                  {/* Render as text, not HTML — prevents XSS */}
                  {line || "\u00a0"}
                </span>
              );
            })}
          </pre>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>No diff available.</p>
        )}
      </div>

      {/* Helper text */}
      <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
        ℹ️ This diff shows the proposed code change. Marking as Applied records that a developer
        applied the patch to MiniShop. It does not automatically modify the MiniShop source code
        or any Git branches.
      </p>
    </div>
  );
}
