import { describe, expect, it, vi, afterEach } from "vitest";
import { retrieve } from "./retrieval";
afterEach(() => vi.unstubAllEnvs());
describe("retrieval abstention", () => {
  it("does not treat a possessive apostrophe as relevant code evidence", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "lexical");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    const result = await retrieve("What is Saturn's orbital eccentricity?");
    expect(result.sources).toHaveLength(0);
  });
});
