import { afterEach, describe, expect, it, vi } from "vitest";
const model = vi.hoisted(() => vi.fn());
vi.mock("../llm/client", () => ({ callLLM: model }));
import { answerQuestion, retrieveContext } from "./rag";
afterEach(() => { vi.unstubAllEnvs(); model.mockReset(); });
describe("RAG generation workflow (model responses simulated)", () => {
  it("returns a generated answer only with citations from its retrieved context", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "lexical");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "legacy");
    const question = "cartStore total items price quantity";
    const sources = await retrieveContext(question);
    model.mockResolvedValue(JSON.stringify({
      answer: "The cart calculation includes item price and quantity.", citations: [sources[0].chunkId], abstained: false,
    }));
    const answer = await answerQuestion(question);
    expect(answer.mode).toBe("generated");
    expect(answer.citations).toEqual([sources[0].chunkId]);
    expect(answer.answer).toContain(sources[0].source);
    expect(answer.warnings).toEqual([]);
  });
  it("returns source excerpts with an explicit warning when generation fails", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "lexical");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "legacy");
    model.mockRejectedValue(new Error("simulated model outage"));
    const answer = await answerQuestion("cart total price quantity");
    expect(answer.mode).toBe("extractive");
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.warnings).toContain("GENERATION_UNAVAILABLE");
    expect(answer.scope).toBe("source");
    expect(answer.sources.every((source) => source.sourceType !== "documentation")).toBe(true);
  });

  it("retrieves project documentation only when explicitly requested", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "lexical");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    const answer = await answerQuestion("Why use RAG rather than fine-tuning?", "documentation");
    expect(answer.scope).toBe("documentation");
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.sources.every((source) => source.sourceType === "documentation")).toBe(true);
  });
});
