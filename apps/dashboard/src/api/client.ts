import type { BugCase } from "../types";

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

  // 202 Accepted or 204 No Content — no body to parse
  if (res.status === 202 || res.status === 204) return undefined as T;

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
  createCase: (body: { title: string; description: string }, signal?: AbortSignal) =>
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
};
