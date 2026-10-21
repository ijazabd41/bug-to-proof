import { describe, expect, it, vi } from "vitest";
import seed from "../../../../data/cases/case-001.seed.json";
import { buildDebugGraph } from "./debugAgent";
import type { RunResult } from "../runner/playwrightRunner";
import type { BugCase } from "@bug-to-proof/shared-types";
const result = (outcome: RunResult["outcome"], fingerprint = "same"): RunResult => ({
  passed: outcome === "PASSED", outcome, expected: "$30.00", actual: outcome, durationMs: 1,
  runId: "unit-test", testFingerprint: fingerprint, testIds: ["cart-total"], reportHash: "unit-report",
  artifactPaths: {}, rawOutput: "",
});
function setup(outcomes: RunResult[], baseline = true) {
  let source = "total: () => get().items[0]?.price ?? 0,";
  const run = vi.fn().mockImplementation(async () => outcomes.shift()!);
  const write = vi.fn((value: string) => { source = value; });
  const graph = buildDebugGraph({
    run, baseline: () => baseline, readSource: () => source, writeSource: write,
    persist: vi.fn(), retrieve: async () => ({ answer: "Local sources", mode: "extractive", scope: "source", sources: [] }),
  });
  return { graph, run, write };
}
describe("LangGraph debugging gates (simulated runner)", () => {
  it.each(["INFRASTRUCTURE_ERROR", "PASSED"] as const)("stops at a %s baseline", async (outcome) => {
    const { graph, run, write } = setup([result(outcome)]);
    const report = await graph.invoke({ bugCase: structuredClone(seed) as BugCase, applyPatch: true });
    expect(report.outcome).toBe("BLOCKED"); expect(run).toHaveBeenCalledTimes(1); expect(write).not.toHaveBeenCalled();
  });
  it("requires opt-in to apply a proposed patch", async () => {
    const { graph, write } = setup([result("ASSERTION_FAILED")]);
    const report = await graph.invoke({ bugCase: structuredClone(seed) as BugCase, applyPatch: false });
    expect(report.outcome).toBe("NEEDS_PATCH_REVIEW"); expect(write).not.toHaveBeenCalled();
  });
  it("verifies with the same test and accounts for quantity", async () => {
    const { graph, run, write } = setup([result("ASSERTION_FAILED"), result("PASSED")]);
    const report = await graph.invoke({ bugCase: structuredClone(seed) as BugCase, applyPatch: true });
    expect(report.outcome).toBe("VERIFIED");
    expect(write.mock.calls[0][0]).toContain("item.price * item.quantity");
    expect(run.mock.calls[0][1]).toBe(run.mock.calls[1][1]);
  });
  it("rejects a pass from changed test inputs", async () => {
    const { graph } = setup([result("ASSERTION_FAILED"), result("PASSED", "changed")]);
    const report = await graph.invoke({ bugCase: structuredClone(seed) as BugCase, applyPatch: true });
    expect(report.outcome).toBe("VERIFICATION_FAILED");
  });
  it("does not apply an unsupported case", async () => {
    const { graph, write } = setup([result("ASSERTION_FAILED")]);
    const bugCase = { ...structuredClone(seed), id: "another-case" } as BugCase;
    expect((await graph.invoke({ bugCase, applyPatch: true })).outcome).toBe("BLOCKED");
    expect(write).not.toHaveBeenCalled();
  });
});
