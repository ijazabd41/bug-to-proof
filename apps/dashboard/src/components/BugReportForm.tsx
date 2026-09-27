import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { BugCase } from "../types";

interface BugReportFormProps {
  onCreated: (c: BugCase) => void;
}

export function BugReportForm({ onCreated }: BugReportFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus first field when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key closes dialog
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle) {
      setError("Title is required.");
      titleRef.current?.focus();
      return;
    }
    if (!trimmedDesc) {
      setError("Description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createCase({
        title: trimmedTitle,
        description: trimmedDesc,
      });
      // Clear and close form, notify parent list
      setTitle("");
      setDescription("");
      setOpen(false);
      onCreated(created);
      // Navigate to the new case
      navigate(`/cases/${created.id}`);
    } catch (err) {
      // Preserve input on failure
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
    fontFamily: "inherit",
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 20px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
        }}
        aria-haspopup="dialog"
      >
        + New Bug Report
      </button>

      {/* Modal dialog */}
      {open && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-form-title"
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 28,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                id="bug-form-title"
                style={{ fontSize: 17, fontWeight: 700, color: "#1f2328" }}
              >
                Report a Bug
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close dialog"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#9ca3af",
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  color: "#b91c1c",
                  background: "#fee2e2",
                  padding: "10px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="bug-title"
                  style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                >
                  Title <span style={{ color: "#b91c1c" }}>*</span>
                </label>
                <input
                  id="bug-title"
                  ref={titleRef}
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the bug"
                  disabled={submitting}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="bug-description"
                  style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                >
                  Description <span style={{ color: "#b91c1c" }}>*</span>
                </label>
                <textarea
                  id="bug-description"
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Steps to reproduce, expected vs actual behavior…"
                  disabled={submitting}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: "8px 18px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    fontSize: 14,
                    color: "#374151",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
