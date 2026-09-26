import React, { useState } from "react";
import { api } from "../api/client";
import type { BugCase } from "../types";

interface BugReportFormProps {
  onCreated: (c: BugCase) => void;
}

export function BugReportForm({ onCreated }: BugReportFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createCase({ title, description });
      setTitle("");
      setDescription("");
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    background: "#fff",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 20,
        background: "#fff",
        marginBottom: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Report a Bug</h2>

      {error && (
        <div style={{ color: "#b91c1c", background: "#fee2e2", padding: 10, borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Title</label>
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the bug"
          required
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps to reproduce, expected vs actual behavior…"
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          alignSelf: "flex-start",
          padding: "8px 20px",
          background: submitting ? "#93c5fd" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: submitting ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {submitting ? "Submitting…" : "Submit Bug Report"}
      </button>
    </form>
  );
}
