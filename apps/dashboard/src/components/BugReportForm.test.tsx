/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BugReportForm } from "./BugReportForm";
import { api } from "../api/client";

vi.mock("../api/client", () => ({ api: { createCase: vi.fn() } }));

describe("BugReportForm structured reports", () => {
  it("requires steps and both outcomes before creating a case", async () => {
    vi.mocked(api.createCase).mockClear();
    render(<MemoryRouter><BugReportForm onCreated={vi.fn()} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Cart total is wrong" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "The total excludes products" } });
    fireEvent.click(screen.getByRole("button", { name: /create case/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/reproduction steps/i);
    expect(api.createCase).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/reproduction steps/i)).toBeRequired();
    expect(screen.getByLabelText(/expected behavior/i)).toBeRequired();
    expect(screen.getByLabelText(/actual behavior/i)).toBeRequired();
  });

  it("submits report facts as first-class fields", async () => {
    vi.mocked(api.createCase).mockResolvedValue({ id: "case-new" } as never);
    render(<MemoryRouter><BugReportForm onCreated={vi.fn()} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Cart total is wrong" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "The total excludes products" } });
    fireEvent.change(screen.getByLabelText(/reproduction steps/i), { target: { value: "Open cart\nAdd two products" } });
    fireEvent.change(screen.getByLabelText(/expected behavior/i), { target: { value: "Both prices appear" } });
    fireEvent.change(screen.getByLabelText(/actual behavior/i), { target: { value: "One price appears" } });
    fireEvent.change(screen.getByLabelText(/starting path/i), { target: { value: "/cart" } });
    fireEvent.change(screen.getByLabelText(/additional context/i), { target: { value: "Desktop" } });
    fireEvent.click(screen.getByRole("button", { name: /create case/i }));

    await waitFor(() => expect(api.createCase).toHaveBeenCalledWith({
      title: "Cart total is wrong",
      description: "The total excludes products",
      steps: ["Open cart", "Add two products"],
      expected: "Both prices appear",
      actual: "One price appears",
      startPath: "/cart",
      context: "Desktop",
    }));
  });
});
