import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Color map per spec:
 * - REPORTED: gray
 * - READY_TO_REPRODUCE: neutral/blue
 * - REPRODUCING / VERIFYING: blue, subtle pulse
 * - REPRODUCED: red with explanatory wording
 * - REPRODUCTION_FAILED / VERIFICATION_FAILED: orange
 * - PATCH_PROPOSED: yellow
 * - PATCH_APPLIED: blue
 * - VERIFIED: green
 */
const STATUS_COLORS = {
    REPORTED: { bg: "#e5e7eb", text: "#6b7280" },
    READY_TO_REPRODUCE: { bg: "#dbeafe", text: "#1d4ed8" },
    REPRODUCING: { bg: "#bfdbfe", text: "#1d4ed8" },
    REPRODUCED: { bg: "#fee2e2", text: "#b91c1c" },
    REPRODUCTION_FAILED: { bg: "#ffedd5", text: "#c2410c" },
    PATCH_PROPOSED: { bg: "#fef9c3", text: "#854d0e" },
    PATCH_APPLIED: { bg: "#dbeafe", text: "#1d4ed8" },
    VERIFYING: { bg: "#bfdbfe", text: "#1d4ed8" },
    VERIFIED: { bg: "#dcfce7", text: "#15803d" },
    VERIFICATION_FAILED: { bg: "#ffedd5", text: "#c2410c" },
};
const PULSE_STATUSES = ["REPRODUCING", "VERIFYING"];
const STATUS_LABELS = {
    REPRODUCED: "REPRODUCED (bug confirmed)",
    REPRODUCTION_FAILED: "REPRODUCTION FAILED",
    VERIFICATION_FAILED: "VERIFICATION FAILED",
    READY_TO_REPRODUCE: "READY TO REPRODUCE",
    PATCH_PROPOSED: "PATCH PROPOSED",
    PATCH_APPLIED: "PATCH APPLIED",
};
export function StatusBadge({ status }) {
    const { bg, text } = STATUS_COLORS[status] ?? { bg: "#e5e7eb", text: "#6b7280" };
    const isPulsing = PULSE_STATUSES.includes(status);
    const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
    return (_jsxs("span", { role: "status", "aria-label": `Status: ${label}`, style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            background: bg,
            color: text,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
        }, children: [isPulsing && (_jsx("span", { "aria-hidden": "true", style: {
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: text,
                    display: "inline-block",
                    animation: "btp-pulse 1.2s ease-in-out infinite",
                } })), label, _jsx("style", { children: `
        @keyframes btp-pulse { 0%,100%{opacity:1}50%{opacity:0.25} }
        @media (prefers-reduced-motion: reduce) { [style*="btp-pulse"] { animation: none !important; } }
      ` })] }));
}
//# sourceMappingURL=StatusBadge.js.map