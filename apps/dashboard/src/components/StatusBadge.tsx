import React from "react";
import type { CaseStatus } from "../types";

const STATUS_COLORS: Record<CaseStatus, { bg: string; text: string }> = {
  REPORTED:             { bg: "#e5e7eb", text: "#374151" },
  READY_TO_REPRODUCE:   { bg: "#dbeafe", text: "#1d4ed8" },
  REPRODUCING:          { bg: "#fef3c7", text: "#b45309" },
  REPRODUCED:           { bg: "#fee2e2", text: "#b91c1c" },
  REPRODUCTION_FAILED:  { bg: "#f3e8ff", text: "#7c3aed" },
  PATCH_PROPOSED:       { bg: "#ffedd5", text: "#c2410c" },
  PATCH_APPLIED:        { bg: "#fef9c3", text: "#854d0e" },
  VERIFYING:            { bg: "#fef3c7", text: "#b45309" },
  VERIFIED:             { bg: "#dcfce7", text: "#15803d" },
  VERIFICATION_FAILED:  { bg: "#fee2e2", text: "#b91c1c" },
};

const PULSE_STATUSES: CaseStatus[] = ["REPRODUCING", "VERIFYING"];

export function StatusBadge({ status }: { status: CaseStatus }) {
  const { bg, text } = STATUS_COLORS[status] ?? { bg: "#e5e7eb", text: "#374151" };
  const isPulsing = PULSE_STATUSES.includes(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color: text,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {isPulsing && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: text,
            display: "inline-block",
            animation: "pulse 1.2s ease-in-out infinite",
          }}
        />
      )}
      {status.replace(/_/g, " ")}
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>
    </span>
  );
}
