import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { BugCase } from "../types";
import { CaseDetail } from "../components/CaseDetail";

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bugCase, setBugCase] = useState<BugCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getCase(id);
      setBugCase(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  if (loading) return <p style={{ color: "#6b7280", padding: "24px 0" }}>Loading…</p>;
  if (error)
    return (
      <div style={{ color: "#b91c1c", background: "#fee2e2", padding: 12, borderRadius: 6 }}>
        {error}
      </div>
    );
  if (!bugCase) return <p style={{ color: "#9ca3af" }}>Case not found.</p>;

  return (
    <div>
      <Link
        to="/"
        style={{ color: "#3b82d4", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← Back to cases
      </Link>
      <CaseDetail bugCase={bugCase} onUpdate={(updated) => setBugCase(updated)} />
    </div>
  );
}
