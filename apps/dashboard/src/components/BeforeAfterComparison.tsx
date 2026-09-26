import React from "react";
import type { Evidence } from "../types";
import { EvidencePanel } from "./EvidencePanel";

interface BeforeAfterComparisonProps {
  evidence: Evidence[];
}

export function BeforeAfterComparison({ evidence }: BeforeAfterComparisonProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
      }}
    >
      <div
        style={{
          border: "1px solid #fee2e2",
          borderRadius: 8,
          padding: 16,
          background: "#fff",
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#b91c1c", marginBottom: 12 }}>
          ❌ Before Patch
        </h4>
        <EvidencePanel evidence={evidence} phase="before" />
      </div>

      <div
        style={{
          border: "1px solid #dcfce7",
          borderRadius: 8,
          padding: 16,
          background: "#fff",
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 12 }}>
          ✅ After Patch
        </h4>
        <EvidencePanel evidence={evidence} phase="after" />
      </div>
    </div>
  );
}
