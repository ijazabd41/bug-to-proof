/** @vitest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseDetail } from "./CaseDetail";
import type { BugCase } from "../types";
import type { ReproductionRunRecordSummary, ReproductionRunState } from "../types/reproduction";

const mocks = vi.hoisted(() => ({
  listReproductionRuns: vi.fn(), getReproductionRun: vi.fn(), startReproductionRun: vi.fn(), cancelReproductionRun: vi.fn(), reviewReproductionRun: vi.fn(),
  reproduce: vi.fn(), getCase: vi.fn(), updateCase: vi.fn(), verify: vi.fn(), demoReset: vi.fn(),
}));
vi.mock("../api/client", () => ({ api: mocks }));
vi.mock("./AIAssistant", () => ({ AIAssistant: () => null }));

const completeCase = (overrides: Partial<BugCase> = {}): BugCase => ({
  id: "case-complete", title: "Complete report", description: "A complete report", status: "REPORTED",
  createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z",
  report: { schemaVersion: "1.0", steps: ["Open cart"], expected: "$20", actual: "$10", startPath: "/", context: "" },
  reportCompleteness: { complete: true, missingFields: [] },
  reproduction: { preconditions: [], steps: ["Open cart"], expected: "$20", actual: "$10", testFile: "", lastRun: null },
  patch: null, verification: null, evidence: [], rootCauseExplanation: null, ...overrides,
});
const run = (state: ReproductionRunState, id = "run-1"): ReproductionRunRecordSummary => ({
  schemaVersion: "1.0", reproductionRunId: id, caseId: "case-complete", state, attempts: state === "AWAITING_TEST_REVIEW" ? [{ attempt: 1, classification: "ASSERTION_FAILED", definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64) }] : [],
  events: [{ sequence: 1, state, message: `durable ${state}`, createdAt: "2026-10-12T00:00:00.000Z" }],
  createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z",
});

beforeEach(() => { vi.clearAllMocks(); mocks.listReproductionRuns.mockResolvedValue([]); });
afterEach(() => vi.useRealTimers());

describe("CaseDetail arbitrary reproduction lifecycle", () => {
  it("shows structured report fields instead of empty legacy reproduction placeholders", () => {
    render(<CaseDetail bugCase={completeCase({
      reproduction: { preconditions: [], steps: ["Legacy placeholder"], expected: "", actual: "", testFile: "", lastRun: null },
    })} onUpdate={vi.fn()} />);
    expect(screen.getByText("Open cart")).toBeInTheDocument();
    expect(screen.getByText("$20")).toBeInTheDocument();
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.queryByText("Legacy placeholder")).not.toBeInTheDocument();
  });

  it("shows Generate reproduction for a complete testless case", async () => {
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate reproduction/i })).toBeInTheDocument();
    await waitFor(() => expect(mocks.listReproductionRuns).toHaveBeenCalledWith("case-complete"));
  });

  it("blocks incomplete reports and shows exact missing fields", () => {
    render(<CaseDetail bugCase={completeCase({ reportCompleteness: { complete: false, missingFields: ["expected", "actual"] } })} onUpdate={vi.fn()} />);
    expect(screen.getByText("More report details are required: expected, actual.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate reproduction/i })).not.toBeInTheDocument();
  });

  it("retains the configured-test reproduction workflow", () => {
    render(<CaseDetail bugCase={completeCase({ reproduction: { preconditions: [], steps: [], expected: "", actual: "", testFile: "tests/playwright/case.spec.ts", lastRun: null } })} onUpdate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /mark as ready to reproduce/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate reproduction/i })).not.toBeInTheDocument();
  });

  it("explains that a passing configured baseline is not an AI repair", () => {
    render(<CaseDetail bugCase={completeCase({
      reproduction: {
        preconditions: [], steps: ["Open cart"], expected: "$20", actual: "$20",
        testFile: "tests/playwright/case.spec.ts",
        lastRun: {
          outcome: "PASSED", passed: true, expected: "$20", actual: "$20",
          durationMs: 12, runAt: "2026-10-12T00:00:00.000Z", evidenceIds: [],
        },
      },
    })} onUpdate={vi.fn()} />);
    expect(screen.getByText(/configured reproduction test/i)).toBeInTheDocument();
    expect(screen.getByText(/baseline passed on the current source/i)).toBeInTheDocument();
    expect(screen.getByText(/does not mean the generation provider repaired it/i)).toBeInTheDocument();
  });

  it("handles the 202 start response by displaying the durable record", async () => {
    mocks.startReproductionRun.mockResolvedValue({ reproductionRunId: "run-started", caseId: "case-complete", state: "DISCOVERING_TARGET" });
    mocks.getReproductionRun.mockResolvedValue(run("GENERATING_CANDIDATE", "run-started"));
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate reproduction/i }));
    expect(await screen.findByText("GENERATING_CANDIDATE")).toBeInTheDocument();
    expect(screen.getByText(/durable GENERATING_CANDIDATE/)).toBeInTheDocument();
  });

  it("polls only active states and stops when a review state arrives", async () => {
    vi.useFakeTimers(); mocks.listReproductionRuns.mockResolvedValue([run("GENERATING_CANDIDATE")]);
    mocks.getReproductionRun.mockResolvedValue(run("AWAITING_TEST_REVIEW"));
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(mocks.getReproductionRun).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(6000); await Promise.resolve(); });
    expect(mocks.getReproductionRun).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /approve & confirm baseline/i })).toBeInTheDocument();
  });

  it("cleans polling on unmount and case change", async () => {
    vi.useFakeTimers(); mocks.listReproductionRuns.mockResolvedValueOnce([run("GENERATING_CANDIDATE")]).mockResolvedValueOnce([]);
    const view = render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    view.rerender(<CaseDetail bugCase={completeCase({ id: "case-other" })} onUpdate={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(3000); await Promise.resolve(); });
    expect(mocks.getReproductionRun).not.toHaveBeenCalled();
    view.unmount();
  });

  it("refreshes the durable record after cancellation instead of trusting the response", async () => {
    mocks.listReproductionRuns.mockResolvedValue([run("GENERATING_CANDIDATE")]);
    mocks.cancelReproductionRun.mockResolvedValue({ reproductionRunId: "run-1", state: "CANCELLED" });
    mocks.getReproductionRun.mockResolvedValue(run("BLOCKED"));
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /cancel generation/i }));
    expect(await screen.findByText("BLOCKED")).toBeInTheDocument();
  });

  it("renders all review and terminal outcomes with distinct visual treatments", async () => {
    const states: ReproductionRunState[] = ["CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "BLOCKED", "CANCELLED", "AWAITING_TEST_REVIEW"];
    const treatments = new Set<string>();
    for (const state of states) {
      mocks.listReproductionRuns.mockResolvedValueOnce([run(state, `run-${state}`)]);
      const view = render(<CaseDetail bugCase={completeCase({ id: `case-${state}` })} onUpdate={vi.fn()} />);
      const badge = await screen.findByText(state); treatments.add(badge.getAttribute("style") ?? "");
      if (state === "AWAITING_TEST_REVIEW") expect(screen.getByRole("button", { name: /approve & confirm baseline/i })).toBeInTheDocument();
      view.unmount();
    }
    expect(treatments.size).toBe(states.length);
  });

  it("preserves the last durable state and shows polling failures honestly", async () => {
    vi.useFakeTimers(); mocks.listReproductionRuns.mockResolvedValue([run("GENERATING_CANDIDATE")]);
    mocks.getReproductionRun.mockRejectedValue(new Error("poll unavailable"));
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(mocks.getReproductionRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GENERATING_CANDIDATE")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("poll unavailable");
  });

  it("explains a provider connection failure without implying a product bug", async () => {
    mocks.listReproductionRuns.mockResolvedValue([{
      ...run("BLOCKED"),
      events: [{ sequence: 1, state: "BLOCKED", message: "Reproduction generation provider request failed (request_failed)", createdAt: "2026-10-12T00:00:00.000Z" }],
      stopReason: "Generation provider failed",
    }]);
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    expect(await screen.findByText(/provider connection failed before an HTTP response/i)).toBeInTheDocument();
    expect(screen.getByText(/no product bug was reproduced/i)).toBeInTheDocument();
  });

  it("shows a timed-out provider request and its bounded retry count", async () => {
    mocks.listReproductionRuns.mockResolvedValue([{
      ...run("BLOCKED"),
      attempts: [{ attempt: 1, classification: "PROVIDER_ERROR", provider: "openai", requestAttempts: 3, responseShape: "request_timed_out", diagnostics: "Provider request timed out (request_timed_out)" }],
      events: [{ sequence: 1, state: "BLOCKED", message: "Provider request timed out (request_timed_out)", createdAt: "2026-10-12T00:00:00.000Z" }],
      stopReason: "Generation provider failed",
    }]);
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    expect((await screen.findAllByText(/provider request timed out/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/provider requests: 3/i)).toBeInTheDocument();
  });

  it("explains quota exhaustion and offers a safe new generation run", async () => {
    mocks.listReproductionRuns.mockResolvedValue([{
      ...run("BLOCKED"),
      attempts: [{ attempt: 1, classification: "PROVIDER_ERROR", provider: "openai", requestAttempts: 3, httpStatus: 429, responseShape: "http_error:429", diagnostics: "Provider returned HTTP 429 (http_error:429)" }],
      events: [{ sequence: 1, state: "BLOCKED", message: "Provider returned HTTP 429 (http_error:429)", createdAt: "2026-10-21T04:39:34.453Z" }],
      stopReason: "Generation provider failed",
    }]);
    render(<CaseDetail bugCase={completeCase()} onUpdate={vi.fn()} />);
    expect((await screen.findAllByText(/provider returned HTTP 429/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/wait for provider quota.*then retry/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry generation/i })).toBeInTheDocument();
    expect(screen.getByText(/provider requests: 3/i)).toBeInTheDocument();
  });

  it("submits the exact candidate hashes and refreshes the case after approval", async () => {
    const reviewable = run("AWAITING_TEST_REVIEW");
    mocks.listReproductionRuns.mockResolvedValue([reviewable]); mocks.reviewReproductionRun.mockResolvedValue({ ...reviewable, state: "REPRODUCED" });
    const updated = completeCase({ status: "REPRODUCED", reproduction: { ...completeCase().reproduction!, testFile: "accepted.spec.ts" } });
    mocks.getCase.mockResolvedValue(updated); const onUpdate = vi.fn();
    render(<CaseDetail bugCase={completeCase()} onUpdate={onUpdate} />);
    fireEvent.change(await screen.findByLabelText(/reviewer notes/i), { target: { value: "Relevant assertion" } });
    fireEvent.click(screen.getByRole("button", { name: /approve & confirm baseline/i }));
    await waitFor(() => expect(mocks.reviewReproductionRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ decision: "APPROVE", definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64), reviewerNotes: "Relevant assertion" })));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated));
  });
});
