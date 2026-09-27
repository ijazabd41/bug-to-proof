import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { EvidencePanel } from "./EvidencePanel";
/**
 * A failed baseline assertion means the bug was successfully reproduced.
 * We label it clearly: "Bug reproduced — baseline test failed."
 * We never assume after=PASSED; we derive the label from the actual afterRun.
 */
export function BeforeAfterComparison({ evidence, verification }) {
    const beforeRun = verification?.beforeRun ?? null;
    const afterRun = verification?.afterRun ?? null;
    const hasBeforeEvidence = evidence.some((e) => e.phase === "before");
    const hasAfterEvidence = evidence.some((e) => e.phase === "after");
    // Derive before-panel label from actual run data
    let beforeLabel;
    let beforeBorder = "#e5e7eb";
    if (beforeRun != null) {
        if (!beforeRun.passed) {
            // Test failed = bug was reproduced successfully
            beforeLabel = (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#b91c1c" }, children: "\u274C FAILED" }), _jsx("span", { style: { color: "#6b7280", fontWeight: 400, fontSize: 12 }, children: " \u2014 Bug reproduced" })] }));
            beforeBorder = "#fecaca";
        }
        else {
            beforeLabel = _jsx("span", { style: { color: "#15803d" }, children: "\u2705 PASSED" });
            beforeBorder = "#bbf7d0";
        }
    }
    else {
        beforeLabel = _jsx("span", { style: { color: "#9ca3af" }, children: "Before Patch" });
    }
    // Derive after-panel label from actual run data
    let afterLabel;
    let afterBorder = "#e5e7eb";
    if (afterRun != null) {
        if (afterRun.passed) {
            afterLabel = (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#15803d" }, children: "\u2705 PASSED" }), _jsx("span", { style: { color: "#6b7280", fontWeight: 400, fontSize: 12 }, children: " \u2014 Bug fixed" })] }));
            afterBorder = "#bbf7d0";
        }
        else {
            afterLabel = (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#c2410c" }, children: "\u26A0\uFE0F FAILED" }), _jsx("span", { style: { color: "#6b7280", fontWeight: 400, fontSize: 12 }, children: " \u2014 Patch did not fix the bug" })] }));
            afterBorder = "#fed7aa";
        }
    }
    else {
        afterLabel = _jsx("span", { style: { color: "#9ca3af" }, children: "After Patch" });
    }
    return (_jsxs("div", { style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
        }, children: [_jsx("style", { children: `
        @media (max-width: 640px) {
          .btp-before-after { grid-template-columns: 1fr !important; }
        }
      ` }), _jsxs("div", { style: {
                    border: `1px solid ${beforeBorder}`,
                    borderRadius: 8,
                    padding: 16,
                    background: "#fff",
                }, children: [_jsxs("h4", { style: {
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }, children: ["Before Patch \u2014 ", beforeLabel] }), hasBeforeEvidence ? (_jsx(EvidencePanel, { evidence: evidence, phase: "before", run: beforeRun })) : (_jsx("p", { style: { color: "#9ca3af", fontSize: 13 }, children: "Evidence unavailable." }))] }), _jsxs("div", { style: {
                    border: `1px solid ${afterBorder}`,
                    borderRadius: 8,
                    padding: 16,
                    background: "#fff",
                }, children: [_jsxs("h4", { style: {
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }, children: ["After Patch \u2014 ", afterLabel] }), hasAfterEvidence ? (_jsx(EvidencePanel, { evidence: evidence, phase: "after", run: afterRun })) : (_jsx("p", { style: { color: "#9ca3af", fontSize: 13 }, children: "Not run yet." }))] })] }));
}
//# sourceMappingURL=BeforeAfterComparison.js.map