import React from "react";
import type { Evidence, Verification } from "../types";
import { EvidencePanel } from "./EvidencePanel";

interface BeforeAfterComparisonProps {
  evidence: Evidence[];
  /**
   * Optional verification data to derive pass/fail labels from actual run results
   * rather than hard-coding before=FAILED / after=PASSED.
   */
  verification?: Verification | null;
}

/**
 * A failed baseline assertion means the bug was successfully reproduced.
 * We label it clearly: "Bug reproduced — baseline test failed."
 * We never assume after=PASSED; we derive the label from the actual afterRun.
 */
export function BeforeAfterComparison({ evidence, verification }: BeforeAfterComparisonProps) {
  const beforeRun = verification?.beforeRun ?? null;
  const afterRun = verification?.afterRun ?? null;

  const hasBeforeEvidence = evidence.some((e) => e.phase === "before");
  const hasAfterEvidence = evidence.some((e) => e.phase === "after");

  // Derive before-panel label from actual run data
  let beforeLabel: React.ReactNode;
  let beforeBorder = "#e5e7eb";
  if (beforeRun != null) {
    if (!beforeRun.passed) {
      // Test failed = bug was reproduced successfully
      beforeLabel = (
        <>
          <span style={{ color: "#b91c1c" }}>❌ FAILED</span>
          <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 12 }}> — Bug reproduced</span>
        </>
      );
      beforeBorder = "#fecaca";
    } else {
      beforeLabel = <span style={{ color: "#15803d" }}>✅ PASSED</span>;
      beforeBorder = "#bbf7d0";
    }
  } else {
    beforeLabel = <span style={{ color: "#9ca3af" }}>Before Patch</span>;
  }

  // Derive after-panel label from actual run data
  let afterLabel: React.ReactNode;
  let afterBorder = "#e5e7eb";
  if (afterRun != null) {
    if (afterRun.passed) {
      afterLabel = (
        <>
          <span style={{ color: "#15803d" }}>✅ PASSED</span>
          <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 12 }}> — Bug fixed</span>
        </>
      );
      afterBorder = "#bbf7d0";
    } else {
      afterLabel = (
        <>
          <span style={{ color: "#c2410c" }}>⚠️ FAILED</span>
          <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 12 }}> — Patch did not fix the bug</span>
        </>
      );
      afterBorder = "#fed7aa";
    }
  } else {
    afterLabel = <span style={{ color: "#9ca3af" }}>After Patch</span>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .btp-before-after { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Before panel */}
      <div
        style={{
          border: `1px solid ${beforeBorder}`,
          borderRadius: 8,
          padding: 16,
          background: "#fff",
        }}
      >
        <h4
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Before Patch — {beforeLabel}
        </h4>
        {hasBeforeEvidence ? (
          <EvidencePanel evidence={evidence} phase="before" run={beforeRun} />
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Evidence unavailable.</p>
        )}
      </div>

      {/* After panel */}
      <div
        style={{
          border: `1px solid ${afterBorder}`,
          borderRadius: 8,
          padding: 16,
          background: "#fff",
        }}
      >
        <h4
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          After Patch — {afterLabel}
        </h4>
        {hasAfterEvidence ? (
          <EvidencePanel evidence={evidence} phase="after" run={afterRun} />
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Not run yet.</p>
        )}
      </div>
    </div>
  );
}
