import React from "react";
import { Link } from "react-router-dom";
import type { BugCase } from "../types";
import { StatusBadge } from "./StatusBadge";

interface CaseListProps {
  cases: BugCase[];
  loading: boolean;
  error: string | null;
}

export function CaseList({ cases, loading, error }: CaseListProps) {
  if (loading) {
    return <p style={{ color: "#6b7280", padding: "24px 0" }}>Loading cases…</p>;
  }
  if (error) {
    return (
      <div style={{ color: "#b91c1c", background: "#fee2e2", padding: 12, borderRadius: 6 }}>
        {error}
      </div>
    );
  }
  if (cases.length === 0) {
    return (
      <p style={{ color: "#9ca3af", padding: "24px 0" }}>
        No cases yet. Submit your first bug report above.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cases.map((c) => (
        <Link
          key={c.id}
          to={`/cases/${c.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "16px 20px",
              background: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.borderColor = "#3b82d4")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb")
            }
          >
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>{c.title}</p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                {c.id} · {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
