import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
export function CaseList({ cases, loading, error }) {
    if (loading) {
        return _jsx("p", { style: { color: "#6b7280", padding: "24px 0" }, children: "Loading cases\u2026" });
    }
    if (error) {
        return (_jsx("div", { style: { color: "#b91c1c", background: "#fee2e2", padding: 12, borderRadius: 6 }, children: error }));
    }
    if (cases.length === 0) {
        return (_jsx("p", { style: { color: "#9ca3af", padding: "24px 0" }, children: "No cases yet. Submit your first bug report above." }));
    }
    return (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: cases.map((c) => (_jsx(Link, { to: `/cases/${c.id}`, style: { textDecoration: "none", color: "inherit" }, children: _jsxs("div", { style: {
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "16px 20px",
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "border-color 0.15s",
                }, onMouseEnter: (e) => (e.currentTarget.style.borderColor = "#3b82d4"), onMouseLeave: (e) => (e.currentTarget.style.borderColor = "#e5e7eb"), children: [_jsxs("div", { children: [_jsx("p", { style: { fontWeight: 600, marginBottom: 4 }, children: c.title }), _jsxs("p", { style: { fontSize: 13, color: "#6b7280" }, children: [c.id, " \u00B7 ", new Date(c.createdAt).toLocaleDateString()] })] }), _jsx(StatusBadge, { status: c.status })] }) }, c.id))) }));
}
//# sourceMappingURL=CaseList.js.map