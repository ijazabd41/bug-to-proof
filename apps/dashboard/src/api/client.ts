import type { BugCase } from "../types";
import type {
  ReproductionRunRecordSummary,
  StartReproductionRunResponse,
} from "../types/reproduction";

export interface CreateCaseRequest {
  title: string;
  description: string;
  steps?: string[];
  expected?: string;
  actual?: string;
  startPath?: string;
  context?: string;
}

// Remove trailing slash so we can always prefix with "/"
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";
export const API_BASE = RAW_BASE.replace(/\/$/, "");

/**
 * Resolve a relative artifact path (e.g. "artifacts/case-001/before/screenshot.png")
 * to an absolute URL using the configured API origin.
 */
export function artifactUrl(relativePath: string): string {
  if (!relativePath) return "";
  // If already absolute, return as-is
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return `${API_BASE}/${relativePath.replace(/^\//, "")}`;
}

interface ApiErrorBody {
  error?: string;
  details?: string;
  message?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(
      `Network error — could not reach ${API_BASE}. Is the API server running?`
    );
  }

  if (!res.ok) {
    let errBody: ApiErrorBody = {};
    try {
      errBody = (await res.json()) as ApiErrorBody;
    } catch {
      // non-JSON error body
    }
    const message =
      errBody.error ?? errBody.message ?? res.statusText ?? `HTTP ${res.status}`;
    const details = errBody.details ? ` — ${errBody.details}` : "";
    const err = new Error(`${message}${details}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  // 202 Accepted or 204 No Content — no body to parse (unless JSON body exists)
  if (res.status === 202 || res.status === 204) {
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  return res.json() as Promise<T>;
}

export const api = {
  /** GET /api/cases */
  getCases: (signal?: AbortSignal) =>
    request<BugCase[]>("/api/cases", { signal }),

  /** GET /api/cases/:id */
  getCase: (id: string, signal?: AbortSignal) =>
    request<BugCase>(`/api/cases/${id}`, { signal }),

  /** POST /api/cases */
  createCase: (body: CreateCaseRequest, signal?: AbortSignal) =>
    request<BugCase>("/api/cases", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),

  /** PATCH /api/cases/:id */
  updateCase: (id: string, body: Partial<BugCase>, signal?: AbortSignal) =>
    request<BugCase>(`/api/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      signal,
    }),

  /** POST /api/cases/:id/reproduce — returns 202 */
  reproduce: (id: string, signal?: AbortSignal) =>
    request<void>(`/api/cases/${id}/reproduce`, { method: "POST", signal }),

  /** POST /api/cases/:id/verify — returns 202 */
  verify: (id: string, signal?: AbortSignal) =>
    request<void>(`/api/cases/${id}/verify`, { method: "POST", signal }),

  /** GET /api/cases/:id/evidence */
  getEvidence: (id: string, signal?: AbortSignal) =>
    request<BugCase["evidence"]>(`/api/cases/${id}/evidence`, { signal }),

  /** POST /api/demo/reset */
  demoReset: (signal?: AbortSignal) =>
    request<BugCase>("/api/demo/reset", { method: "POST", signal }),

  /** POST /api/cases/:caseId/reproduction-runs — returns 202 with StartReproductionRunResponse */
  startReproductionRun: (caseId: string, signal?: AbortSignal) =>
    request<StartReproductionRunResponse>(
      `/api/cases/${caseId}/reproduction-runs`,
      { method: "POST", signal }
    ),

  /** GET /api/cases/:caseId/reproduction-runs */
  listReproductionRuns: (caseId: string, signal?: AbortSignal) =>
    request<ReproductionRunRecordSummary[]>(
      `/api/cases/${caseId}/reproduction-runs`,
      { signal }
    ),

  /** GET /api/reproduction-runs/:runId */
  getReproductionRun: (runId: string, signal?: AbortSignal) =>
    request<ReproductionRunRecordSummary>(
      `/api/reproduction-runs/${runId}`,
      { signal }
    ),

  /** POST /api/reproduction-runs/:runId/cancel */
  cancelReproductionRun: (runId: string, signal?: AbortSignal) =>
    request<{ reproductionRunId: string; state: string }>(
      `/api/reproduction-runs/${runId}/cancel`,
      { method: "POST", signal }
    ),

  /** POST /api/reproduction-runs/:runId/review — hash-bound human decision */
  reviewReproductionRun: (runId: string, body: { decision: "APPROVE" | "REJECT"; definitionHash: string; compiledTestHash: string; acceptedBy: string; reviewerNotes?: string }, signal?: AbortSignal) =>
    request<ReproductionRunRecordSummary>(`/api/reproduction-runs/${runId}/review`, {
      method: "POST", body: JSON.stringify(body), signal,
    }),
};
