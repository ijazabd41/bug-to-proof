/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { ReportClarification } from "./ReportClarification";
import type { BugCase } from "../types";

vi.mock("../api/client", () => ({ api: { updateCase: vi.fn() } }));

it("keeps an incomplete clarification on screen until required report facts are supplied", () => {
  vi.mocked(api.updateCase).mockClear();
  const bugCase = {
    id: "case-new",
    report: { schemaVersion: "1.0", steps: [], expected: "Expected", actual: "Actual", startPath: "", context: "" },
  } as unknown as BugCase;
  render(<ReportClarification bugCase={bugCase} onUpdate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Save report details" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/reproduction steps/i);
  expect(api.updateCase).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/reproduction steps/i)).toBeRequired();
  expect(screen.getByLabelText(/expected behavior/i)).toBeRequired();
  expect(screen.getByLabelText(/actual behavior/i)).toBeRequired();
});

it("saves a complete structured clarification", async () => {
  const bugCase = {
    id: "case-new",
    report: { schemaVersion: "1.0", steps: [], expected: "", actual: "", startPath: "", context: "" },
  } as unknown as BugCase;
  const updated = { ...bugCase, reportCompleteness: { complete: true, missingFields: [] } } as BugCase;
  vi.mocked(api.updateCase).mockResolvedValue(updated);
  const onUpdate = vi.fn();
  render(<ReportClarification bugCase={bugCase} onUpdate={onUpdate} />);

  fireEvent.change(screen.getByLabelText(/Reproduction steps/), { target: { value: "Open cart\nAdd two products" } });
  fireEvent.change(screen.getByLabelText(/Expected behavior/), { target: { value: "Both prices appear" } });
  fireEvent.change(screen.getByLabelText(/Actual behavior/), { target: { value: "One price appears" } });
  fireEvent.click(screen.getByRole("button", { name: "Save report details" }));

  await waitFor(() => expect(api.updateCase).toHaveBeenCalledWith("case-new", {
    report: {
      schemaVersion: "1.0",
      steps: ["Open cart", "Add two products"],
      expected: "Both prices appear",
      actual: "One price appears",
      startPath: "",
      context: "",
    },
  }));
  expect(onUpdate).toHaveBeenCalledWith(updated);
});
