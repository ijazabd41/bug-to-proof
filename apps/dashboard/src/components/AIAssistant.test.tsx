import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AIAssistant } from "./AIAssistant";

afterEach(cleanup);

const mockRun = {
  runId: "run-sample-123",
  caseId: "case-001",
  mode: "dynamic",
  state: "AWAITING_REVIEW",
  attempt: 1,
  maxAttempts: 3,
  originalSourceFingerprint: "fp123",
  proposal: {
    proposalId: "prop-456",
    diagnosis: "Off-by-one error in cart reducer",
    assumptions: ["Items are added incrementally"],
    rationale: "Sum all items using reduce",
    unifiedDiff: "--- a/cart.ts\n+++ b/cart.ts\n@@ -1 +1 @@\n-sum\n+total",
    proposalHash: "a".repeat(64),
    proposedAt: new Date().toISOString(),
  },
  requiredChecks: [
    {
      checkId: "chk-1",
      name: "MiniShop Unit Tests",
      type: "unit",
      command: "npm test",
      passed: true,
      durationMs: 50,
      output: "All tests passed",
    },
  ],
  events: [
    {
      timestamp: new Date().toISOString(),
      stage: "proposal",
      message: "Generated candidate patch",
    },
  ],
};

describe("AIAssistant Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores saved repair runs on case load and renders proposal", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ semantic: false, embeddingProvider: "offline", chunks: 5 }),
        });
      }
      if (url.includes("/api/ai/cases/case-001/repair-runs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockRun]),
        });
      }
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;

    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<AIAssistant caseId="case-001" onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/Repair Run: run-sample-123/)).toBeDefined();
      expect(screen.getByText(/Off-by-one error in cart reducer/)).toBeDefined();
      expect(screen.getByText(/Approve & Apply Exact Patch/)).toBeDefined();
    });
  });

  it("renders cancel button and triggers cancel request when active", async () => {
    const runningRun = {
      ...mockRun,
      state: "RUNNING_CHECKS",
      proposal: undefined,
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ semantic: false, embeddingProvider: "offline", chunks: 5 }),
        });
      }
      if (url.includes("/api/ai/cases/case-001/repair-runs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([runningRun]),
        });
      }
      if (url.includes("/api/ai/repair-runs/run-sample-123/cancel")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...runningRun, state: "CANCELLED" }),
        });
      }
      if (url.includes("/api/ai/repair-runs/run-sample-123")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(runningRun),
        });
      }
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;

    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<AIAssistant caseId="case-001" onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel Run")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Cancel Run"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/ai/repair-runs/run-sample-123/cancel"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
