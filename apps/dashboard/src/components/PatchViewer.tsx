import React from "react";
import type { Patch } from "../types";

interface PatchViewerProps {
  patch: Patch;
}

export function PatchViewer({ patch }: PatchViewerProps) {
  const lines = patch.diff.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Summary</p>
        <p style={{ fontSize: 14, color: "#374151" }}>{patch.summary}</p>
      </div>

      {patch.reasoning && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Reasoning</p>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{patch.reasoning}</p>
        </div>
      )}

      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Diff</p>
        <pre
          style={{
            background: "#0d1117",
            color: "#c9d1d9",
            padding: 16,
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {lines.map((line, i) => {
            let color = "#c9d1d9";
            if (line.startsWith("+") && !line.startsWith("+++")) color = "#3fb950";
            if (line.startsWith("-") && !line.startsWith("---")) color = "#f85149";
            if (line.startsWith("@@")) color = "#79c0ff";
            return (
              <span key={i} style={{ color, display: "block" }}>
                {line}
              </span>
            );
          })}
        </pre>
      </div>

      <div style={{ fontSize: 13, color: "#6b7280" }}>
        Files changed: {patch.filesChanged.join(", ")}
      </div>
    </div>
  );
}
