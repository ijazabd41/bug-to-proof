import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPRODUCTION_LIMITS,
  REPRODUCTION_RUN_TRANSITIONS,
  canTransitionReproductionRun,
  type ReproductionRunRecord,
} from "./contracts";

describe("arbitrary reproduction contracts", () => {
  it("defines bounded defaults for candidate generation", () => {
    expect(DEFAULT_REPRODUCTION_LIMITS).toEqual({
      maxAttempts: 3,
      maxSteps: 20,
      maxRuntimeMs: 120_000,
      maxDefinitionBytes: 32_000,
      maxDiagnosticBytes: 16_000,
    });
  });

  it("permits only documented lifecycle transitions", () => {
    expect(REPRODUCTION_RUN_TRANSITIONS.NEEDS_REPORT_DETAILS).toContain("DISCOVERING_TARGET");
    expect(REPRODUCTION_RUN_TRANSITIONS.AWAITING_TEST_REVIEW).toEqual(
      expect.arrayContaining(["GENERATING_CANDIDATE", "CONFIRMING_BASELINE", "CANCELLED"]),
    );
    expect(canTransitionReproductionRun("CONFIRMING_BASELINE", "REPRODUCED")).toBe(true);
    expect(canTransitionReproductionRun("CANDIDATE_EXECUTION_ERROR", "REPRODUCED")).toBe(false);
    expect(REPRODUCTION_RUN_TRANSITIONS.REPRODUCED).toEqual([]);
  });

  it("keeps durable records versioned and separate from BugCase", () => {
    const record: ReproductionRunRecord = {
      schemaVersion: "1.0",
      reproductionRunId: "repro-run-1",
      caseId: "case-new",
      state: "NEEDS_REPORT_DETAILS",
      reportSnapshot: {
        title: "Cart total is wrong",
        description: "Two products display the wrong total",
      },
      attempts: [],
      events: [],
      limits: DEFAULT_REPRODUCTION_LIMITS,
      stopReason: "A configured or accepted reproduction test does not exist yet",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      completedAt: "2026-10-12T00:00:00.000Z",
    };

    expect(record.schemaVersion).toBe("1.0");
    expect(record.state).toBe("NEEDS_REPORT_DETAILS");
  });
});
