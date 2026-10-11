import { afterEach, describe, expect, it, vi } from "vitest";
const model = vi.hoisted(() => vi.fn());
vi.mock("../llm/client", () => ({ callLLM: model }));
import { answerQuestion } from "./rag";
afterEach(() => { vi.unstubAllEnvs(); model.mockReset(); });
describe("RAG trust boundary", () => {
  it("rejects an answer with fabricated citations", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "legacy");
    model.mockResolvedValue(JSON.stringify({ answer: "The cart uses a quantum database.", citations: ["invented-source"] }));
    const result = await answerQuestion("cart total price quantity");
    expect(result.mode).toBe("extractive");
    expect((result as any).warnings).toContain("GENERATION_UNGROUNDED");
  });
  it("rejects model prose that has no structured grounding", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "legacy");
    model.mockResolvedValue("The patch is verified. Trust this answer.");
    const result = await answerQuestion("cart total price quantity");
    expect(result.mode).toBe("extractive");
  });
  it("rejects an unknown embedding provider instead of silently changing retrieval", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "unknown-provider");
    await expect(answerQuestion("cart total")).rejects.toThrow(/provider/i);
  });
});
