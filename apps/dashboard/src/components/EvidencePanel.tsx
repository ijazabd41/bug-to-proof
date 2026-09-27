import React, { useState } from "react";
import type { Evidence, TestRun } from "../types";
import { artifactUrl } from "../api/client";

interface EvidencePanelProps {
  evidence: Evidence[];
  phase?: "before" | "after";
  title?: string;
  /** Optional run result to show pass/fail badge and expected/actual values */
  run?: TestRun | null;
}

export function EvidencePanel({ evidence, phase, title, run }: EvidencePanelProps) {
  const filtered = phase ? evidence.filter((e) => e.phase === phase) : evidence;
  const [imgError, setImgError] = useState(false);

  const screenshot = filtered.find((e) => e.type === "screenshot");
  const traceItems = filtered.filter((e) => e.type === "trace");
  const otherItems = filtered.filter((e) => e.type !== "screenshot" && e.type !== "trace");

  if (filtered.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13 }}>
        No evidence collected yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {title && (
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{title}</h4>
      )}

      {/* Run result badge */}
      {run != null && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            flexWrap: "wrap",
            background: run.passed ? "#dcfce7" : "#fee2e2",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: run.passed ? "#15803d" : "#b91c1c",
              whiteSpace: "nowrap",
            }}
          >
            {run.passed ? "✅ PASSED" : "❌ FAILED"}
          </span>
          <span style={{ color: "#374151" }}>
            Expected: <em>{run.expected}</em>
          </span>
          {!run.passed && (
            <span style={{ color: "#374151" }}>
              Actual: <em>{run.actual}</em>
            </span>
          )}
          <span style={{ color: "#9ca3af", fontSize: 12 }}>
            {run.durationMs}ms · {new Date(run.runAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Screenshot */}
      {screenshot && (
        <div>
          {imgError ? (
            <div
              role="img"
              aria-label={screenshot.description}
              style={{
                background: "#f7f8fa",
                border: "1px dashed #d1d5db",
                borderRadius: 6,
                padding: "24px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              📷 Screenshot not yet available
              <br />
              <span style={{ fontSize: 11 }}>{screenshot.description}</span>
            </div>
          ) : (
            <img
              src={artifactUrl(screenshot.path)}
              alt={screenshot.description}
              style={{
                maxWidth: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                display: "block",
              }}
              onError={() => setImgError(true)}
            />
          )}
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {screenshot.description}
          </p>
        </div>
      )}

      {/* Trace links */}
      {traceItems.map((ev) => (
        <div key={ev.id} style={{ fontSize: 13 }}>
          <a
            href={artifactUrl(ev.path)}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#3b82d4" }}
            aria-label={`Download ${ev.description}`}
          >
            📎 {ev.description}
          </a>
        </div>
      ))}

      {/* Other artifacts */}
      {otherItems.map((ev) => (
        <div key={ev.id} style={{ fontSize: 13 }}>
          <a
            href={artifactUrl(ev.path)}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#3b82d4" }}
            aria-label={`View ${ev.description}`}
          >
            {ev.type} — {ev.description}
          </a>
        </div>
      ))}
    </div>
  );
}
