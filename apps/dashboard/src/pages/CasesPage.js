import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { CaseList } from "../components/CaseList";
import { BugReportForm } from "../components/BugReportForm";
export function CasesPage() {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadCases = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await api.getCases();
            setCases(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load cases");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadCases();
    }, [loadCases]);
    const handleCreated = (c) => {
        setCases((prev) => [c, ...prev]);
    };
    return (_jsxs("div", { children: [_jsx("div", { style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                    flexWrap: "wrap",
                    gap: 12,
                }, children: _jsx("h1", { style: { fontSize: 22, fontWeight: 700 }, children: "Bug Cases" }) }), _jsx(BugReportForm, { onCreated: handleCreated }), error && (_jsxs("div", { style: {
                    color: "#b91c1c",
                    background: "#fee2e2",
                    padding: "12px 16px",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    border: "1px solid #fecaca",
                }, children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => void loadCases(), style: {
                            padding: "4px 12px",
                            background: "#fff",
                            border: "1px solid #fca5a5",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                            color: "#b91c1c",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                        }, children: "Retry" })] })), _jsx(CaseList, { cases: cases, loading: loading, error: null })] }));
}
//# sourceMappingURL=CasesPage.js.map