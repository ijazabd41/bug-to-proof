import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function classifyDiffLine(line) {
    // File headers (--- a/... and +++ b/...) — do NOT treat as add/remove
    if (line.startsWith("---") || line.startsWith("+++")) {
        return { color: "#8b949e" };
    }
    // Hunk headers
    if (line.startsWith("@@")) {
        return { color: "#79c0ff" };
    }
    // Additions
    if (line.startsWith("+")) {
        return { color: "#3fb950" };
    }
    // Removals
    if (line.startsWith("-")) {
        return { color: "#f85149" };
    }
    // Context lines / diff metadata (index, diff --git, etc.)
    return { color: "#8b949e" };
}
export function PatchViewer({ patch }) {
    const hasDiff = typeof patch.diff === "string" && patch.diff.trim().length > 0;
    const lines = hasDiff ? patch.diff.split("\n") : [];
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: {
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            background: patch.status === "APPLIED" ? "#dcfce7" : "#fef9c3",
                            color: patch.status === "APPLIED" ? "#15803d" : "#854d0e",
                        }, children: patch.status === "APPLIED" ? "✓ Applied" : "○ Proposed" }), patch.appliedAt && (_jsxs("span", { style: { fontSize: 12, color: "#9ca3af" }, children: ["Applied ", new Date(patch.appliedAt).toLocaleString()] })), !patch.appliedAt && patch.proposedAt && (_jsxs("span", { style: { fontSize: 12, color: "#9ca3af" }, children: ["Proposed ", new Date(patch.proposedAt).toLocaleString()] }))] }), patch.summary ? (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }, children: "Summary" }), _jsx("p", { style: { fontSize: 14, color: "#374151", lineHeight: 1.6 }, children: patch.summary })] })) : null, patch.reasoning ? (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }, children: "Reasoning" }), _jsx("p", { style: { fontSize: 13, color: "#6b7280", lineHeight: 1.6 }, children: patch.reasoning })] })) : null, patch.filesChanged.length > 0 && (_jsxs("div", { style: { fontSize: 12, color: "#6b7280" }, children: [_jsx("strong", { children: "Files changed:" }), " ", patch.filesChanged.join(", ")] })), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }, children: "Diff" }), hasDiff ? (_jsx("pre", { style: {
                            background: "#0d1117",
                            color: "#c9d1d9",
                            padding: 16,
                            borderRadius: 6,
                            overflowX: "auto",
                            fontSize: 12,
                            lineHeight: 1.6,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, 'Courier New', monospace",
                            whiteSpace: "pre",
                            tabSize: 4,
                        }, role: "region", "aria-label": "Unified diff", children: lines.map((line, i) => {
                            const { color } = classifyDiffLine(line);
                            return (_jsx("span", { style: { color, display: "block" }, children: line || "\u00a0" }, i));
                        }) })) : (_jsx("p", { style: { color: "#9ca3af", fontSize: 13 }, children: "No diff available." }))] }), _jsx("p", { style: { fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }, children: "\u2139\uFE0F This diff shows the proposed code change. Marking as Applied records that a developer applied the patch to MiniShop. It does not automatically modify the MiniShop source code or any Git branches." })] }));
}
//# sourceMappingURL=PatchViewer.js.map