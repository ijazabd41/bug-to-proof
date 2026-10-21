import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../ai/providers", () => ({
  ragConfig: () => ({ generationProvider: "legacy", generationModel: "fixture", timeoutMs: 1_000 }),
  generateAnswer: vi.fn(),
}));
vi.mock("../llm/client", () => ({ callLLMWithDiagnostics: mocks.call }));

import { generateReproductionCandidate, REPRODUCTION_MAX_OUTPUT_TOKENS } from "./generationProvider";

const context = {
  promptVersion: "reproduction-v2" as const,
  report: { title: "Cart", description: "Cart issue" },
  discovery: { schemaVersion: "1.0" as const, sourceFingerprint: "source", inventoryDigest: "inventory", routes: ["/"], controls: [], headings: [], fixtures: { products: [] }, sourceFiles: [], capturedAt: "2026-10-13T00:00:00.000Z" },
  attempt: 1,
  previousDiagnostics: [],
};

describe("reproduction provider response boundary", () => {
  beforeEach(() => mocks.call.mockReset());

  it("returns a successful unusable response shape for deterministic candidate validation", async () => {
    mocks.call.mockResolvedValue({ content: "", responseShape: "choices_array:first_choice_object:message_object:content_missing" });
    await expect(generateReproductionCandidate(context)).resolves.toMatchObject({ raw: "", responseShape: "choices_array:first_choice_object:message_object:content_missing" });
    expect(mocks.call).toHaveBeenCalledWith(expect.any(String), 1_000, undefined, REPRODUCTION_MAX_OUTPUT_TOKENS);
  });

  it("keeps HTTP provider failures out of candidate-invalid classification", async () => {
    mocks.call.mockResolvedValue({ content: "", responseShape: "http_error:429" });
    await expect(generateReproductionCandidate(context)).rejects.toThrow("Provider returned HTTP 429 (http_error:429)");
  });
});
