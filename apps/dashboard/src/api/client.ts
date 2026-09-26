import type { BugCase } from "../types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error((err as { error?: string }).error ?? res.statusText), {
      status: res.status,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  /** GET /api/cases */
  getCases: () => request<BugCase[]>("/api/cases"),

  /** GET /api/cases/:id */
  getCase: (id: string) => request<BugCase>(`/api/cases/${id}`),

  /** POST /api/cases */
  createCase: (body: { title: string; description: string }) =>
    request<BugCase>("/api/cases", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** PATCH /api/cases/:id */
  updateCase: (id: string, body: Partial<BugCase>) =>
    request<BugCase>(`/api/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** DELETE /api/cases/:id */
  deleteCase: (id: string) =>
    request<void>(`/api/cases/${id}`, { method: "DELETE" }),

  /** POST /api/cases/:id/reproduce */
  reproduce: (id: string) =>
    request<{ message: string; caseId: string }>(`/api/cases/${id}/reproduce`, {
      method: "POST",
    }),

  /** POST /api/cases/:id/verify */
  verify: (id: string) =>
    request<{ message: string; caseId: string }>(`/api/cases/${id}/verify`, {
      method: "POST",
    }),

  /** GET /api/cases/:id/evidence */
  getEvidence: (id: string) =>
    request<BugCase["evidence"]>(`/api/cases/${id}/evidence`),

  /** POST /api/demo/reset */
  demoReset: () => request<BugCase>("/api/demo/reset", { method: "POST" }),
};
