import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { CasesPage } from "./pages/CasesPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs("div", { style: { minHeight: "100vh", background: "#f7f8fa" }, children: [_jsxs("header", { style: {
                        background: "#fff",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "0 24px",
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                    }, children: [_jsx(Link, { to: "/", style: { textDecoration: "none", color: "inherit" }, children: _jsx("span", { style: { fontWeight: 700, fontSize: 16, color: "#1f2328" }, children: "\uD83D\uDD0D Bug-to-Proof" }) }), _jsx("span", { style: { fontSize: 12, color: "#9ca3af" }, children: "Reported \u2192 Reproduced \u2192 Patched \u2192 Verified" })] }), _jsx("main", { style: { maxWidth: 900, margin: "0 auto", padding: "32px 24px" }, children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(CasesPage, {}) }), _jsx(Route, { path: "/cases/:id", element: _jsx(CaseDetailPage, {}) })] }) })] }) }));
}
//# sourceMappingURL=App.js.map