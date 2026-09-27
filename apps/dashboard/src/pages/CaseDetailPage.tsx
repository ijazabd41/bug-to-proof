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
  const [notFound, setNotFound] = useState(false);

  const loadCase = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    setNotFound(false);
    try {
      const data = await api.getCase(id);
      setBugCase(data);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load case");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  if (loading) {
    return (
      <div>
        <Link
          to="/"
          style={{
            color: "#3b82d4",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 20,
          }}
        >
          ← Back to cases
        </Link>
        <p style={{ color: "#6b7280", padding: "24px 0" }}>Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <Link
          to="/"
          style={{
            color: "#3b82d4",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 20,
          }}
        >
          ← Back to cases
        </Link>
        <div
          style={{
            background: "#f7f8fa",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "32px 24px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
            Case not found
          </p>
          <p style={{ fontSize: 14 }}>
            No case with ID <code style={{ fontFamily: "monospace" }}>{id}</code> exists.
          </p>
          <Link
            to="/"
            style={{ color: "#3b82d4", fontSize: 14, display: "inline-block", marginTop: 16 }}
          >
            View all cases →
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link
          to="/"
          style={{
            color: "#3b82d4",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 20,
          }}
        >
          ← Back to cases
        </Link>
        <div
          style={{
            color: "#b91c1c",
            background: "#fee2e2",
            padding: "12px 16px",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid #fecaca",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => void loadCase()}
            style={{
              padding: "4px 12px",
              background: "#fff",
              border: "1px solid #fca5a5",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              color: "#b91c1c",
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!bugCase) return null;

  return (
    <div>
      <Link
        to="/"
        style={{
          color: "#3b82d4",
          fontSize: 13,
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 20,
        }}
      >
        ← Back to cases
      </Link>
      <CaseDetail bugCase={bugCase} onUpdate={(updated) => setBugCase(updated)} />
    </div>
  );
}
