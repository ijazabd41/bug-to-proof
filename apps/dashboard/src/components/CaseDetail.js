import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { StatusBadge } from "./StatusBadge";
import { PatchViewer } from "./PatchViewer";
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import { EvidencePanel } from "./EvidencePanel";
const POLLING_STATUSES = new Set(["REPRODUCING", "VERIFYING"]);
const DEMO_CASE_ID = "case-001";
export function CaseDetail({ bugCase, onUpdate }) {
    const [actionError, setActionError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [pollingError, setPollingError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [resetting, setResetting] = useState(false);
    // Use a ref for polling so we don't stale-close over the current case id
    const pollTimeoutRef = useRef(null);
    const isMountedRef = useRef(true);
    const currentCaseIdRef = useRef(bugCase.id);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    // Keep ref current with the case ID
    useEffect(() => {
        currentCaseIdRef.current = bugCase.id;
    }, [bugCase.id]);
    // ── Polling via setTimeout chain (no overlapping requests) ────────────────────
    const schedulePoll = useCallback((caseId) => {
        if (pollTimeoutRef.current)
            clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current)
                return;
            if (currentCaseIdRef.current !== caseId)
                return; // different case loaded
            try {
                const fresh = await api.getCase(caseId);
                if (!isMountedRef.current || currentCaseIdRef.current !== caseId)
                    return;
                setPollingError(null);
                onUpdate(fresh);
                // Keep polling while still in a running state
                if (POLLING_STATUSES.has(fresh.status)) {
                    schedulePoll(caseId);
                }
            }
            catch (err) {
                if (!isMountedRef.current || currentCaseIdRef.current !== caseId)
                    return;
                // Retain last known data — show recoverable error
                setPollingError(err instanceof Error ? err.message : "Polling failed — retrying…");
                // Retry after a slightly longer delay on error
                if (POLLING_STATUSES.has(bugCase.status)) {
                    pollTimeoutRef.current = setTimeout(() => schedulePoll(caseId), 4000);
                }
            }
        }, 2000);
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onUpdate]);
    useEffect(() => {
        if (POLLING_STATUSES.has(bugCase.status)) {
            schedulePoll(bugCase.id);
        }
        else {
            if (pollTimeoutRef.current)
                clearTimeout(pollTimeoutRef.current);
        }
        return () => {
            if (pollTimeoutRef.current)
                clearTimeout(pollTimeoutRef.current);
        };
    }, [bugCase.status, bugCase.id, schedulePoll]);
    // ── Manual refresh ────────────────────────────────────────────────────────────
    const handleRefresh = async () => {
        setRefreshing(true);
        setActionError(null);
        try {
            const fresh = await api.getCase(bugCase.id);
            onUpdate(fresh);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Refresh failed");
        }
        finally {
            setRefreshing(false);
        }
    };
    // ── Generic action wrapper ────────────────────────────────────────────────────
    const doAction = async (fn, opts = {}) => {
        const { refreshAfter = true, startPolling = false } = opts;
        setActionError(null);
        setActionLoading(true);
        try {
            await fn();
            if (startPolling) {
                // 202 accepted — start polling immediately
                schedulePoll(bugCase.id);
                return;
            }
            if (refreshAfter) {
                const fresh = await api.getCase(bugCase.id);
                onUpdate(fresh);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Action failed";
            setActionError(msg);
            // On 409, refresh to get the current actual state
            if (err instanceof Error && err.status === 409) {
                try {
                    const fresh = await api.getCase(bugCase.id);
                    onUpdate(fresh);
                }
                catch {
                    // ignore secondary error
                }
            }
        }
        finally {
            setActionLoading(false);
        }
    };
    // ── Demo Reset (only for case-001) ────────────────────────────────────────────
    const handleDemoReset = async () => {
        setResetting(true);
        setActionError(null);
        try {
            const reset = await api.demoReset();
            if (reset)
                onUpdate(reset);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Demo reset failed");
        }
        finally {
            setResetting(false);
        }
    };
    // ── Section wrapper ───────────────────────────────────────────────────────────
    const section = (title, children) => (_jsxs("section", { style: {
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 20,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 14,
        }, children: [_jsx("h3", { style: { fontSize: 15, fontWeight: 600, color: "#374151" }, children: title }), children] }));
    const isRunning = POLLING_STATUSES.has(bugCase.status);
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs("div", { style: {
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 20,
                    background: "#fff",
                }, children: [_jsxs("div", { style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                            flexWrap: "wrap",
                        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("h2", { style: {
                                            fontSize: 20,
                                            fontWeight: 700,
                                            marginBottom: 6,
                                            wordBreak: "break-word",
                                        }, children: bugCase.title }), _jsxs("p", { style: { fontSize: 13, color: "#6b7280" }, children: [bugCase.id, " \u00B7 Created", " ", new Date(bugCase.createdAt).toLocaleString(), " \u00B7 Updated", " ", new Date(bugCase.updatedAt).toLocaleString()] }), _jsx("p", { style: {
                                            marginTop: 10,
                                            fontSize: 14,
                                            color: "#374151",
                                            lineHeight: 1.6,
                                        }, children: bugCase.description })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }, children: [_jsx(StatusBadge, { status: bugCase.status }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { onClick: handleRefresh, disabled: refreshing || isRunning, "aria-label": "Refresh case data", title: "Refresh case data from the server", style: {
                                                    padding: "5px 12px",
                                                    background: "#f3f4f6",
                                                    border: "1px solid #d1d5db",
                                                    borderRadius: 6,
                                                    cursor: refreshing ? "not-allowed" : "pointer",
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    color: "#374151",
                                                }, children: refreshing ? "…" : "↺ Refresh" }), bugCase.id === DEMO_CASE_ID && (_jsx("button", { onClick: handleDemoReset, disabled: resetting || isRunning, title: "Reset case-001 to its seed state (REPRODUCED + patch PROPOSED). Resets case data only \u2014 does not modify MiniShop source code, Git branches, or committed artifacts.", style: {
                                                    padding: "5px 12px",
                                                    background: resetting ? "#d1d5db" : "#fff7ed",
                                                    border: "1px solid #fed7aa",
                                                    borderRadius: 6,
                                                    cursor: resetting ? "not-allowed" : "pointer",
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    color: "#c2410c",
                                                }, children: resetting ? "Resetting…" : "↺ Demo Reset" }))] })] })] }), bugCase.id === DEMO_CASE_ID && (_jsx("p", { style: {
                            marginTop: 10,
                            fontSize: 11,
                            color: "#9ca3af",
                            lineHeight: 1.5,
                        }, children: "\u2139\uFE0F Demo Reset restores case-001 to the seeded REPRODUCED state so the demo can be repeated. It resets case data only \u2014 it does not modify MiniShop source code, Git branches, or any committed artifacts." }))] }), actionError && (_jsx("div", { role: "alert", style: {
                    background: "#fee2e2",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    border: "1px solid #fecaca",
                }, children: actionError })), pollingError && (_jsxs("div", { role: "status", style: {
                    background: "#fff7ed",
                    color: "#c2410c",
                    padding: "8px 14px",
                    borderRadius: 6,
                    fontSize: 12,
                    border: "1px solid #fed7aa",
                }, children: ["\u26A0\uFE0F ", pollingError, " \u2014 last known state shown above."] })), isRunning && (_jsxs("div", { role: "status", "aria-live": "polite", style: {
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    border: "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }, children: [_jsx("span", { style: {
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#3b82f6",
                            animation: "btp-pulse 1.2s ease-in-out infinite",
                        } }), bugCase.status === "REPRODUCING"
                        ? "Reproduction in progress — polling for results…"
                        : "Verification in progress — polling for results…"] })), bugCase.status === "REPRODUCTION_FAILED" && (_jsxs("div", { style: {
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 8,
                    padding: "16px 20px",
                }, children: [_jsx("p", { style: { fontWeight: 700, color: "#c2410c", marginBottom: 4 }, children: "\u26A0\uFE0F Reproduction Failed" }), _jsx("p", { style: { fontSize: 13, color: "#374151", lineHeight: 1.6 }, children: "The Playwright test runner could not reproduce the bug. This may indicate a MiniShop connectivity issue, an infrastructure error, or that the test is not applicable to the current environment. Check that MiniShop is running on port 5174 and retry reproduction." }), _jsx("p", { style: { fontSize: 12, color: "#9ca3af", marginTop: 8 }, children: "Note: REPRODUCTION_FAILED means the runner encountered an error, not that the bug doesn't exist." })] })), bugCase.status === "VERIFICATION_FAILED" && (_jsxs("div", { style: {
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 8,
                    padding: "16px 20px",
                }, children: [_jsx("p", { style: { fontWeight: 700, color: "#c2410c", marginBottom: 4 }, children: "\u26A0\uFE0F Verification Failed" }), _jsx("p", { style: { fontSize: 13, color: "#374151", lineHeight: 1.6 }, children: "The Playwright test still failed after the patch was applied. Either the patch does not fully fix the bug, MiniShop is not running the patched version, or the runner encountered an infrastructure error." })] })), bugCase.rootCauseExplanation
                ? section("Root Cause Analysis", _jsx("p", { style: {
                        fontSize: 14,
                        color: "#374151",
                        lineHeight: 1.7,
                        background: "#f7f8fa",
                        padding: 12,
                        borderRadius: 6,
                    }, children: bugCase.rootCauseExplanation }))
                : null, section("Reproduction", _jsxs(_Fragment, { children: [bugCase.reproduction ? (_jsxs(_Fragment, { children: [bugCase.reproduction.preconditions.length > 0 && (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "Preconditions" }), _jsx("ul", { style: { paddingLeft: 20, fontSize: 13, color: "#374151" }, children: bugCase.reproduction.preconditions.map((p, i) => (_jsx("li", { style: { marginBottom: 4 }, children: p }, i))) })] })), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "Steps" }), _jsx("ol", { style: { paddingLeft: 20, fontSize: 13, color: "#374151" }, children: bugCase.reproduction.steps.map((s, i) => (_jsx("li", { style: { marginBottom: 4 }, children: s }, i))) })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "#15803d",
                                                    marginBottom: 4,
                                                }, children: "Expected" }), _jsx("p", { style: { fontSize: 13, color: "#374151" }, children: bugCase.reproduction.expected || "—" })] }), _jsxs("div", { children: [_jsx("p", { style: {
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "#b91c1c",
                                                    marginBottom: 4,
                                                }, children: "Actual" }), _jsx("p", { style: { fontSize: 13, color: "#374151" }, children: bugCase.reproduction.actual || "—" })] })] }), bugCase.reproduction.lastRun != null && (_jsxs("div", { style: {
                                    background: bugCase.reproduction.lastRun.passed
                                        ? "#dcfce7"
                                        : "#fee2e2",
                                    padding: "10px 14px",
                                    borderRadius: 6,
                                    fontSize: 13,
                                }, children: ["Last run:", " ", bugCase.reproduction.lastRun.passed ? "✅ PASSED" : "❌ FAILED", " \u2014", " ", bugCase.reproduction.lastRun.durationMs, "ms at", " ", new Date(bugCase.reproduction.lastRun.runAt).toLocaleString(), !bugCase.reproduction.lastRun.passed && (_jsx("p", { style: { marginTop: 4, fontSize: 12, color: "#6b7280" }, children: "Bug reproduced \u2014 baseline test failed as expected." }))] }))] })) : (_jsx("p", { style: { color: "#9ca3af", fontSize: 13 }, children: "No reproduction info yet." })), bugCase.status === "REPORTED" && (_jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.updateCase(bugCase.id, { status: "READY_TO_REPRODUCE" })), style: btnStyle("#6b7280", actionLoading), children: actionLoading ? "Updating…" : "→ Mark as Ready to Reproduce" })), bugCase.status === "READY_TO_REPRODUCE" && (_jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.reproduce(bugCase.id), {
                            refreshAfter: false,
                            startPolling: true,
                        }), style: btnStyle("#3b82f6", actionLoading), children: actionLoading ? "Starting…" : "▶ Run Reproduction" })), bugCase.status === "REPRODUCED" && (_jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.reproduce(bugCase.id), {
                            refreshAfter: false,
                            startPolling: true,
                        }), style: btnStyle("#3b82f6", actionLoading), children: actionLoading ? "Starting…" : "▶ Re-run Reproduction" })), bugCase.status === "REPRODUCTION_FAILED" && (_jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.updateCase(bugCase.id, { status: "READY_TO_REPRODUCE" })), style: btnStyle("#f59e0b", actionLoading), children: actionLoading ? "Updating…" : "↺ Reset to Ready (retry reproduction)" })), bugCase.evidence.some((e) => e.phase === "before") && (_jsx(EvidencePanel, { evidence: bugCase.evidence, phase: "before", title: "Before Evidence", run: bugCase.reproduction?.lastRun ?? null }))] })), bugCase.patch
                ? section("Proposed Patch", _jsxs(_Fragment, { children: [_jsx(PatchViewer, { patch: bugCase.patch }), bugCase.status === "REPRODUCED" && bugCase.patch.status === "PROPOSED" && (_jsxs("div", { style: {
                                background: "#f7f8fa",
                                border: "1px solid #e5e7eb",
                                borderRadius: 6,
                                padding: "12px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }, children: [_jsx("p", { style: { fontSize: 13, color: "#374151" }, children: "A patch has been proposed. Accept it to advance the case to the Patch Proposed state, then mark it as applied once the fix is applied to MiniShop." }), _jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.updateCase(bugCase.id, { status: "PATCH_PROPOSED" })), style: btnStyle("#7c5cd8", actionLoading), children: actionLoading ? "Updating…" : "✓ Accept Proposed Patch" })] })), bugCase.status === "PATCH_PROPOSED" && (_jsxs("div", { style: {
                                background: "#f7f8fa",
                                border: "1px solid #e5e7eb",
                                borderRadius: 6,
                                padding: "12px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }, children: [_jsx("p", { style: { fontSize: 13, color: "#374151" }, children: "Mark this patch as applied once you have manually applied the diff to MiniShop. This records the application \u2014 it does not automatically modify any source files or Git branches." }), _jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.updateCase(bugCase.id, {
                                        status: "PATCH_APPLIED",
                                        patch: {
                                            ...bugCase.patch,
                                            status: "APPLIED",
                                            appliedAt: new Date().toISOString(),
                                        },
                                    })), style: btnStyle("#10b981", actionLoading), children: actionLoading ? "Updating…" : "✓ Mark as Applied" })] })), bugCase.status === "PATCH_APPLIED" && (_jsxs("div", { style: {
                                background: "#f7f8fa",
                                border: "1px solid #e5e7eb",
                                borderRadius: 6,
                                padding: "12px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }, children: [_jsx("p", { style: { fontSize: 13, color: "#374151" }, children: "Patch has been applied. Run verification to confirm the bug is fixed on the patched MiniShop (must be running on port 5174 with the patch applied)." }), _jsx("button", { disabled: actionLoading, onClick: () => doAction(() => api.verify(bugCase.id), {
                                        refreshAfter: false,
                                        startPolling: true,
                                    }), style: btnStyle("#7c3aed", actionLoading), children: actionLoading ? "Starting…" : "▶ Run Verification" })] }))] }))
                : null, bugCase.verification?.comparison
                ? section("Verification Result", _jsx(_Fragment, { children: _jsxs("div", { style: {
                            background: bugCase.status === "VERIFIED" ? "#dcfce7" : "#fff7ed",
                            padding: 14,
                            borderRadius: 6,
                            fontSize: 14,
                            border: bugCase.status === "VERIFIED"
                                ? "1px solid #bbf7d0"
                                : "1px solid #fed7aa",
                        }, children: [bugCase.status === "VERIFIED" ? (_jsxs(_Fragment, { children: ["\u2705 ", _jsx("strong", { children: "Test passed after patch \u2014 bug is fixed!" })] })) : (_jsxs(_Fragment, { children: ["\u26A0\uFE0F ", _jsx("strong", { children: "Test still failing after patch" }), " \u2014 the patch may not fully address the bug or MiniShop is not running the patched version."] })), bugCase.verification.afterRun != null && (_jsxs("p", { style: { marginTop: 8, fontSize: 12, color: "#6b7280" }, children: ["After run: ", bugCase.verification.afterRun.durationMs, "ms \u00B7", " ", new Date(bugCase.verification.afterRun.runAt).toLocaleString()] }))] }) }))
                : null, (bugCase.evidence.some((e) => e.phase === "before") ||
                bugCase.evidence.some((e) => e.phase === "after"))
                ? section("Before / After Comparison", _jsx(BeforeAfterComparison, { evidence: bugCase.evidence, verification: bugCase.verification }))
                : null] }));
}
function btnStyle(bg, disabled) {
    return {
        alignSelf: "flex-start",
        padding: "8px 20px",
        background: disabled ? "#d1d5db" : bg,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: 14,
    };
}
//# sourceMappingURL=CaseDetail.js.map