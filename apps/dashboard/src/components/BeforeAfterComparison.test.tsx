import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("./EvidencePanel", () => ({ EvidencePanel: () => <div>Evidence</div> }));
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import type { TestRun, Verification } from "../types";
afterEach(cleanup);
const run = (outcome: TestRun["outcome"], passed: boolean): TestRun => ({
  passed, outcome, runAt: new Date().toISOString(), expected: "$30", actual: "$10", durationMs: 1, evidenceIds: [],
});
describe("evidence labels", () => {
  it("does not label infrastructure failure as a reproduced bug", () => {
    const verification: Verification = { status: "PENDING", beforeRun: run("INFRASTRUCTURE_ERROR", false), afterRun: null, comparison: null };
    render(<BeforeAfterComparison evidence={[]} verification={verification} />);
    expect(screen.queryByText(/Bug reproduced/)).toBeNull();
    expect(screen.getByText(/Infrastructure error/i)).toBeDefined();
  }, 15000);
  it("does not call an unverified pass a bug fix", () => {
    const verification: Verification = { status: "PENDING", beforeRun: null, afterRun: run("PASSED", true), comparison: null };
    render(<BeforeAfterComparison evidence={[]} verification={verification} />);
    expect(screen.queryByText(/Bug fixed/)).toBeNull();
  }, 15000);
});
