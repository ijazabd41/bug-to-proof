import React from "react";
import type { Evidence } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

interface EvidencePanelProps {
  evidence: Evidence[];
  phase?: "before" | "after";
  title?: string;
}

export function EvidencePanel({ evidence, phase, title }: EvidencePanelProps) {
  const filtered = phase ? evidence.filter((e) => e.phase === phase) : evidence;

  if (filtered.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13 }}>No evidence collected yet.</p>
    );
  }

  const screenshot = filtered.find((e) => e.type === "screenshot");
  const others = filtered.filter((e) => e.type !== "screenshot");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {title && (
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{title}</h4>
      )}

      {screenshot && (
        <div>
          <img
            src={`${API_BASE}/${screenshot.path}`}
            alt={screenshot.description}
            style={{
              maxWidth: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {screenshot.description}
          </p>
        </div>
      )}

      {others.map((ev) => (
        <div key={ev.id} style={{ fontSize: 13 }}>
          <a
            href={`${API_BASE}/${ev.path}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#3b82d4" }}
          >
            {ev.type} — {ev.description}
          </a>
        </div>
      ))}
    </div>
  );
}
