// Remove trailing slash so we can always prefix with "/"
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export const API_BASE = RAW_BASE.replace(/\/$/, "");
/**
 * Resolve a relative artifact path (e.g. "artifacts/case-001/before/screenshot.png")
 * to an absolute URL using the configured API origin.
 */
export function artifactUrl(relativePath) {
    if (!relativePath)
        return "";
    // If already absolute, return as-is
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
        return relativePath;
    }
    return `${API_BASE}/${relativePath.replace(/^\//, "")}`;
}
async function request(path, options) {
    const url = `${API_BASE}${path}`;
    let res;
    try {
        res = await fetch(url, {
            headers: { "Content-Type": "application/json", ...options?.headers },
            ...options,
        });
    }
    catch (networkErr) {
        throw new Error(`Network error — could not reach ${API_BASE}. Is the API server running?`);
    }
    if (!res.ok) {
        let errBody = {};
        try {
            errBody = (await res.json());
        }
        catch {
            // non-JSON error body
        }
        const message = errBody.error ?? errBody.message ?? res.statusText ?? `HTTP ${res.status}`;
        const details = errBody.details ? ` — ${errBody.details}` : "";
        const err = new Error(`${message}${details}`);
        err.status = res.status;
        throw err;
    }
    // 202 Accepted or 204 No Content — no body to parse
    if (res.status === 202 || res.status === 204)
        return undefined;
    return res.json();
}
export const api = {
    /** GET /api/cases */
    getCases: (signal) => request("/api/cases", { signal }),
    /** GET /api/cases/:id */
    getCase: (id, signal) => request(`/api/cases/${id}`, { signal }),
    /** POST /api/cases */
    createCase: (body, signal) => request("/api/cases", {
        method: "POST",
        body: JSON.stringify(body),
        signal,
    }),
    /** PATCH /api/cases/:id */
    updateCase: (id, body, signal) => request(`/api/cases/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        signal,
    }),
    /** POST /api/cases/:id/reproduce — returns 202 */
    reproduce: (id, signal) => request(`/api/cases/${id}/reproduce`, { method: "POST", signal }),
    /** POST /api/cases/:id/verify — returns 202 */
    verify: (id, signal) => request(`/api/cases/${id}/verify`, { method: "POST", signal }),
    /** GET /api/cases/:id/evidence */
    getEvidence: (id, signal) => request(`/api/cases/${id}/evidence`, { signal }),
    /** POST /api/demo/reset */
    demoReset: (signal) => request("/api/demo/reset", { method: "POST", signal }),
};
//# sourceMappingURL=client.js.map