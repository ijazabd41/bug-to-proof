import React from "react";
import type { Evidence, TestRun } from "../types";
interface EvidencePanelProps {
    evidence: Evidence[];
    phase?: "before" | "after";
    title?: string;
    /** Optional run result to show pass/fail badge and expected/actual values */
    run?: TestRun | null;
}
export declare function EvidencePanel({ evidence, phase, title, run }: EvidencePanelProps): React.JSX.Element;
export {};
//# sourceMappingURL=EvidencePanel.d.ts.map