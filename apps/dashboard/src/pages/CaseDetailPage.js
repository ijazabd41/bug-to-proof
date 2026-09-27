import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { CaseDetail } from "../components/CaseDetail";
export function CaseDetailPage() {
    const { id } = useParams();
    const [bugCase, setBugCase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const loadCase = useCallback(async () => {
        if (!id)
            return;
        setError(null);
        setLoading(true);
        setNotFound(false);
        try {
            const data = await api.getCase(id);
            setBugCase(data);
        }
        catch (err) {
            const status = err.status;
            if (status === 404) {
                setNotFound(true);
            }
            else {
                setError(err instanceof Error ? err.message : "Failed to load case");
            }
        }
        finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        void loadCase();
    }, [loadCase]);
    if (loading) {
        return (_jsxs("div", { children: [_jsx(Link, { to: "/", style: {
                        color: "#3b82d4",
                        fontSize: 13,
                        textDecoration: "none",
                        display: "inline-block",
                        marginBottom: 20,
                    }, children: "\u2190 Back to cases" }), _jsx("p", { style: { color: "#6b7280", padding: "24px 0" }, children: "Loading\u2026" })] }));
    }
    if (notFound) {
        return (_jsxs("div", { children: [_jsx(Link, { to: "/", style: {
                        color: "#3b82d4",
                        fontSize: 13,
                        textDecoration: "none",
                        display: "inline-block",
                        marginBottom: 20,
                    }, children: "\u2190 Back to cases" }), _jsxs("div", { style: {
                        background: "#f7f8fa",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "32px 24px",
                        textAlign: "center",
                        color: "#6b7280",
                    }, children: [_jsx("p", { style: { fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#374151" }, children: "Case not found" }), _jsxs("p", { style: { fontSize: 14 }, children: ["No case with ID ", _jsx("code", { style: { fontFamily: "monospace" }, children: id }), " exists."] }), _jsx(Link, { to: "/", style: { color: "#3b82d4", fontSize: 14, display: "inline-block", marginTop: 16 }, children: "View all cases \u2192" })] })] }));
    }
    if (error) {
        return (_jsxs("div", { children: [_jsx(Link, { to: "/", style: {
                        color: "#3b82d4",
                        fontSize: 13,
                        textDecoration: "none",
                        display: "inline-block",
                        marginBottom: 20,
                    }, children: "\u2190 Back to cases" }), _jsxs("div", { style: {
                        color: "#b91c1c",
                        background: "#fee2e2",
                        padding: "12px 16px",
                        borderRadius: 6,
                        fontSize: 13,
                        border: "1px solid #fecaca",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                    }, children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => void loadCase(), style: {
                                padding: "4px 12px",
                                background: "#fff",
                                border: "1px solid #fca5a5",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                                color: "#b91c1c",
                                fontWeight: 500,
                            }, children: "Retry" })] })] }));
    }
    if (!bugCase)
        return null;
    return (_jsxs("div", { children: [_jsx(Link, { to: "/", style: {
                    color: "#3b82d4",
                    fontSize: 13,
                    textDecoration: "none",
                    display: "inline-block",
                    marginBottom: 20,
                }, children: "\u2190 Back to cases" }), _jsx(CaseDetail, { bugCase: bugCase, onUpdate: (updated) => setBugCase(updated) })] }));
}
//# sourceMappingURL=CaseDetailPage.js.map