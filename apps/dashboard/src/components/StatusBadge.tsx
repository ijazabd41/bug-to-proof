import React from "react";
import type { CaseStatus } from "../types";

/**
 * Color map optimized for a quiet, authoritative editorial light theme:
 * - REPORTED: slate neutral
 * - READY_TO_REPRODUCE: sky/cyan
 * - REPRODUCING / VERIFYING: royal blue with pulse
 * - REPRODUCED: forensic ruby/crimson
 * - REPRODUCTION_FAILED / VERIFICATION_FAILED: burnt orange/amber
 * - PATCH_PROPOSED: warm honey/amber
 * - PATCH_APPLIED: deep emerald/teal
 * - VERIFIED: vibrant emerald proof
 */
const STATUS_COLORS: Record<CaseStatus, { bg: string; text: string; border: string; dot: string }> = {
  REPORTED: {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
    dot: "#64748b",
  },
  READY_TO_REPRODUCE: {
    bg: "#f0f9ff",
    text: "#0284c7",
    border: "#bae6fd",
    dot: "#0284c7",
  },
  REPRODUCING: {
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    dot: "#2563eb",
  },
  REPRODUCED: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    dot: "#dc2626",
  },
  REPRODUCTION_FAILED: {
    bg: "#fff7ed",
    text: "#c2410c",
    border: "#fed7aa",
    dot: "#ea580c",
  },
  PATCH_PROPOSED: {
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
    dot: "#d97706",
  },
  PATCH_APPLIED: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    dot: "#16a34a",
  },
  VERIFYING: {
    bg: "#eef2ff",
    text: "#4338ca",
    border: "#c7d2fe",
    dot: "#4f46e5",
  },
  VERIFIED: {
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
    dot: "#059669",
  },
  VERIFICATION_FAILED: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    dot: "#dc2626",
  },
};

const PULSE_STATUSES: CaseStatus[] = ["REPRODUCING", "VERIFYING"];

const STATUS_LABELS: Partial<Record<CaseStatus, string>> = {
  REPRODUCED: "REPRODUCED (bug confirmed)",
  REPRODUCTION_FAILED: "REPRODUCTION FAILED",
  VERIFICATION_FAILED: "VERIFICATION FAILED",
  READY_TO_REPRODUCE: "READY TO REPRODUCE",
  PATCH_PROPOSED: "PATCH PROPOSED",
  PATCH_APPLIED: "PATCH APPLIED",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const meta = STATUS_COLORS[status] ?? {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#e2e8f0",
    dot: "#64748b",
  };
  const isPulsing = PULSE_STATUSES.includes(status);
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className="status-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
        fontWeight: 600,
        background: meta.bg,
        color: meta.text,
        border: `1px solid ${meta.border}`,
        letterSpacing: "0.02em",
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.dot,
          display: "inline-block",
          flexShrink: 0,
          animation: isPulsing ? "btp-pulse 1.2s ease-in-out infinite" : undefined,
        }}
      />
      {label}
      <style>{`
        @keyframes btp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.85)} }
        @media (prefers-reduced-motion: reduce) { [style*="btp-pulse"] { animation: none !important; } }
      `}</style>
    </span>
  );
}
