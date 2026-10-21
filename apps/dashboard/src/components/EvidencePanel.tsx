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
  const selected = phase ? evidence.filter((e) => e.phase === phase) : evidence;
  const filtered = run ? selected.filter((e) => run.evidenceIds.includes(e.id)) : selected;
  const [imgError, setImgError] = useState(false);

  const screenshot = filtered.find((e) => e.type === "screenshot");
  const traceItems = filtered.filter((e) => e.type === "trace");
  const otherItems = filtered.filter((e) => e.type !== "screenshot" && e.type !== "trace");

  if (filtered.length === 0) {
    return (
      <p style={{ color: "#94a3b8", fontSize: 13 }}>
        No evidence collected yet.
      </p>
    );
  }

  const isPassed = run?.passed;
  const isInfra = run?.outcome === "INFRASTRUCTURE_ERROR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {title && (
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{title}</h4>
      )}

      {/* Run result badge */}
      {run != null && (
        <div
          className="evidence-run"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
            background: isInfra ? "#fff7ed" : isPassed ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${isInfra ? "#fed7aa" : isPassed ? "#a7f3d0" : "#fecaca"}`,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
              color: isInfra ? "#c2410c" : isPassed ? "#047857" : "#b91c1c",
              whiteSpace: "nowrap",
            }}
          >
            {isInfra
              ? "⚠️ INFRASTRUCTURE ERROR"
              : isPassed
              ? "✅ PASSED"
              : "❌ ASSERTION FAILED"}
          </span>
          <span style={{ color: "#334155" }}>
            Expected: <em style={{ color: "#0f172a", fontWeight: 600 }}>{run.expected}</em>
          </span>
          {!run.passed && (
            <details className="failure-details" style={{ width: "100%", marginTop: 4 }}>
              <summary style={{ cursor: "pointer", color: "#b91c1c", fontWeight: 600 }}>
                Actual result · View failure details
              </summary>
              <pre
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  padding: 12,
                  marginTop: 8,
                  color: "#fecaca",
                  fontSize: 11,
                  lineHeight: 1.6,
                  fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {run.actual}
              </pre>
            </details>
          )}
          <span
            style={{
              color: "#64748b",
              fontSize: 11,
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
              marginLeft: "auto",
            }}
          >
            {run.durationMs}ms · {new Date(run.runAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Screenshot */}
      {screenshot && (
        <div className="screenshot-container">
          {imgError ? (
            <div
              role="img"
              aria-label={screenshot.description}
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                padding: "28px 16px",
                textAlign: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              📷 Screenshot not yet available
              <br />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{screenshot.description}</span>
            </div>
          ) : (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 4,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <img
                src={artifactUrl(screenshot.path)}
                alt={screenshot.description}
                style={{
                  maxWidth: "100%",
                  borderRadius: 6,
                  display: "block",
                }}
                onError={() => setImgError(true)}
              />
            </div>
          )}
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📸</span>
            <span>{screenshot.description}</span>
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
            className="artifact-link"
            style={{
              color: "#0284c7",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              padding: "5px 11px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
              fontWeight: 500,
            }}
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
            className="artifact-link"
            style={{
              color: "#0284c7",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              padding: "5px 11px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
              fontWeight: 500,
            }}
            aria-label={`View ${ev.description}`}
          >
            {ev.type} — {ev.description}
          </a>
        </div>
      ))}
    </div>
  );
}
