import React from "react";
import type { Evidence, Verification } from "../types";
interface BeforeAfterComparisonProps {
    evidence: Evidence[];
    /**
     * Optional verification data to derive pass/fail labels from actual run results
     * rather than hard-coding before=FAILED / after=PASSED.
     */
    verification?: Verification | null;
}
/**
 * A failed baseline assertion means the bug was successfully reproduced.
 * We label it clearly: "Bug reproduced — baseline test failed."
 * We never assume after=PASSED; we derive the label from the actual afterRun.
 */
export declare function BeforeAfterComparison({ evidence, verification }: BeforeAfterComparisonProps): React.JSX.Element;
export {};
//# sourceMappingURL=BeforeAfterComparison.d.ts.map