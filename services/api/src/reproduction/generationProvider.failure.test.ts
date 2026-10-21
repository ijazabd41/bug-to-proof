import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => vi.fn());
vi.mock("../llm/client", () => ({ callLLMWithDiagnostics: llm }));
import { generateReproductionCandidate } from "./generationProvider";

describe("reproduction provider failure diagnostics", () => {
  beforeEach(() => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "legacy");
    vi.stubEnv("LLM_MODEL", "test-model");
    llm.mockReset();
  });

  it("describes a connection failure without exposing provider output", async () => {
    llm.mockResolvedValue({ content: "", responseShape: "request_failed" });
    await expect(generateReproductionCandidate({
      promptVersion: "reproduction-v2",
      report: { title: "Shipping total", description: "Total excludes shipping", steps: ["Add item"], expected: "$15", actual: "$10", startPath: "/", context: "" },
      discovery: { schemaVersion: "1.0", sourceFingerprint: "source", inventoryDigest: "inventory", routes: ["/"], controls: [], targets: [], headings: [], fixtures: { products: [] }, sourceFiles: [], capturedAt: "2026-10-15T00:00:00.000Z" },
      attempt: 1,
      previousDiagnostics: [],
    })).rejects.toThrow("Provider connection failed before an HTTP response (request_failed)");
  });
});
