import type { BugCase } from "../types";
export declare const API_BASE: string;
/**
 * Resolve a relative artifact path (e.g. "artifacts/case-001/before/screenshot.png")
 * to an absolute URL using the configured API origin.
 */
export declare function artifactUrl(relativePath: string): string;
export declare const api: {
    /** GET /api/cases */
    getCases: (signal?: AbortSignal) => Promise<BugCase[]>;
    /** GET /api/cases/:id */
    getCase: (id: string, signal?: AbortSignal) => Promise<BugCase>;
    /** POST /api/cases */
    createCase: (body: {
        title: string;
        description: string;
    }, signal?: AbortSignal) => Promise<BugCase>;
    /** PATCH /api/cases/:id */
    updateCase: (id: string, body: Partial<BugCase>, signal?: AbortSignal) => Promise<BugCase>;
    /** POST /api/cases/:id/reproduce — returns 202 */
    reproduce: (id: string, signal?: AbortSignal) => Promise<void>;
    /** POST /api/cases/:id/verify — returns 202 */
    verify: (id: string, signal?: AbortSignal) => Promise<void>;
    /** GET /api/cases/:id/evidence */
    getEvidence: (id: string, signal?: AbortSignal) => Promise<import("@bug-to-proof/shared-types").Evidence[]>;
    /** POST /api/demo/reset */
    demoReset: (signal?: AbortSignal) => Promise<BugCase>;
};
//# sourceMappingURL=client.d.ts.map