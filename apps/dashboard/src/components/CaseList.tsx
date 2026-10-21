import React from "react";
import { Link } from "react-router-dom";
import type { BugCase } from "../types";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";

interface CaseListProps {
  cases: BugCase[];
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
}

export function CaseList({ cases, loading, error, emptyMessage }: CaseListProps) {
  if (loading) {
    return (
      <div className="empty-state" role="status">
        <span className="loading-ring" />
        <span>Loading your cases…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner" role="alert">
        {error}
      </div>
    );
  }

  if (!cases.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="cases" size={32} />
        </div>
        <h3>{emptyMessage ? "Nothing found." : "A clean slate."}</h3>
        <p>{emptyMessage ?? "Report your first bug to start collecting evidence."}</p>
        {!emptyMessage && <a href="#bug-title">Write a bug report →</a>}
      </div>
    );
  }

  return (
    <>
      <div className="case-table-wrap">
        <table className="case-table">
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="sr-only">Open case</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="case-title" to={`/cases/${c.id}`}>
                    {c.title}
                  </Link>
                  <p className="case-description">{c.description}</p>
                  <span className="case-id">{c.id}</span>
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>
                  <time dateTime={c.updatedAt}>
                    {new Date(c.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <span>
                      {new Date(c.updatedAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </time>
                </td>
                <td>
                  <Link
                    className="case-open"
                    to={`/cases/${c.id}`}
                    aria-label={`Open ${c.title}`}
                  >
                    <Icon name="arrow" size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="case-cards">
        {cases.map((c) => (
          <Link className="case-card" key={c.id} to={`/cases/${c.id}`}>
            <div className="case-card-top">
              <span className="case-id">{c.id}</span>
              <StatusBadge status={c.status} />
            </div>
            <h3>{c.title}</h3>
            <p>{c.description}</p>
            <div className="case-card-footer">
              <time dateTime={c.updatedAt}>
                Updated{" "}
                {new Date(c.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span aria-hidden="true" className="card-open-arrow">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
