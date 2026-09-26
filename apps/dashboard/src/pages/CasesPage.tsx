import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { BugCase } from "../types";
import { CaseList } from "../components/CaseList";
import { BugReportForm } from "../components/BugReportForm";

export function CasesPage() {
  const [cases, setCases] = useState<BugCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadCases = useCallback(async () => {
    try {
      const data = await api.getCases();
      setCases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const handleCreated = (c: BugCase) => {
    setCases((prev) => [c, ...prev]);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.demoReset();
      await loadCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Bug Cases</h1>
        <button
          onClick={handleReset}
          disabled={resetting}
          style={{
            padding: "7px 16px",
            background: resetting ? "#d1d5db" : "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: resetting ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: "#374151",
          }}
        >
          {resetting ? "Resetting…" : "↺ Demo Reset"}
        </button>
      </div>

      <BugReportForm onCreated={handleCreated} />
      <CaseList cases={cases} loading={loading} error={error} />
    </div>
  );
}
