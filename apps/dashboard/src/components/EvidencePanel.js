import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { artifactUrl } from "../api/client";
export function EvidencePanel({ evidence, phase, title, run }) {
    const filtered = phase ? evidence.filter((e) => e.phase === phase) : evidence;
    const [imgError, setImgError] = useState(false);
    const screenshot = filtered.find((e) => e.type === "screenshot");
    const traceItems = filtered.filter((e) => e.type === "trace");
    const otherItems = filtered.filter((e) => e.type !== "screenshot" && e.type !== "trace");
    if (filtered.length === 0) {
        return (_jsx("p", { style: { color: "#9ca3af", fontSize: 13 }, children: "No evidence collected yet." }));
    }
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [title && (_jsx("h4", { style: { fontSize: 14, fontWeight: 600, color: "#374151" }, children: title })), run != null && (_jsxs("div", { style: {
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    background: run.passed ? "#dcfce7" : "#fee2e2",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                }, children: [_jsx("span", { style: {
                            fontWeight: 700,
                            color: run.passed ? "#15803d" : "#b91c1c",
                            whiteSpace: "nowrap",
                        }, children: run.passed ? "✅ PASSED" : "❌ FAILED" }), _jsxs("span", { style: { color: "#374151" }, children: ["Expected: ", _jsx("em", { children: run.expected })] }), !run.passed && (_jsxs("span", { style: { color: "#374151" }, children: ["Actual: ", _jsx("em", { children: run.actual })] })), _jsxs("span", { style: { color: "#9ca3af", fontSize: 12 }, children: [run.durationMs, "ms \u00B7 ", new Date(run.runAt).toLocaleString()] })] })), screenshot && (_jsxs("div", { children: [imgError ? (_jsxs("div", { role: "img", "aria-label": screenshot.description, style: {
                            background: "#f7f8fa",
                            border: "1px dashed #d1d5db",
                            borderRadius: 6,
                            padding: "24px 16px",
                            textAlign: "center",
                            color: "#9ca3af",
                            fontSize: 13,
                        }, children: ["\uD83D\uDCF7 Screenshot not yet available", _jsx("br", {}), _jsx("span", { style: { fontSize: 11 }, children: screenshot.description })] })) : (_jsx("img", { src: artifactUrl(screenshot.path), alt: screenshot.description, style: {
                            maxWidth: "100%",
                            border: "1px solid #e5e7eb",
                            borderRadius: 6,
                            display: "block",
                        }, onError: () => setImgError(true) })), _jsx("p", { style: { fontSize: 12, color: "#9ca3af", marginTop: 4 }, children: screenshot.description })] })), traceItems.map((ev) => (_jsx("div", { style: { fontSize: 13 }, children: _jsxs("a", { href: artifactUrl(ev.path), target: "_blank", rel: "noreferrer", style: { color: "#3b82d4" }, "aria-label": `Download ${ev.description}`, children: ["\uD83D\uDCCE ", ev.description] }) }, ev.id))), otherItems.map((ev) => (_jsx("div", { style: { fontSize: 13 }, children: _jsxs("a", { href: artifactUrl(ev.path), target: "_blank", rel: "noreferrer", style: { color: "#3b82d4" }, "aria-label": `View ${ev.description}`, children: [ev.type, " \u2014 ", ev.description] }) }, ev.id)))] }));
}
//# sourceMappingURL=EvidencePanel.js.map