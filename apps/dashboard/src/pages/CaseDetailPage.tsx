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
      <div className="case-detail-page">
        <Link to="/" className="back-nav-link">
          ← Back to cases
        </Link>
        <div className="empty-state" role="status">
          <span className="loading-ring" />
          <span>Loading case details…</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="case-detail-page">
        <Link to="/" className="back-nav-link">
          ← Back to cases
        </Link>
        <div className="panel not-found-panel">
          <h3>Case not found</h3>
          <p>
            No case with ID <code className="mono-badge">{id}</code> exists.
          </p>
          <Link to="/" className="button primary" style={{ marginTop: 16 }}>
            View all cases →
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-detail-page">
        <Link to="/" className="back-nav-link">
          ← Back to cases
        </Link>
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="button" onClick={() => void loadCase()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!bugCase) return null;

  return (
    <div className="case-detail-page">
      <Link to="/" className="back-nav-link">
        ← Back to cases
      </Link>
      <CaseDetail bugCase={bugCase} onUpdate={(updated) => setBugCase(updated)} />
    </div>
  );
}
