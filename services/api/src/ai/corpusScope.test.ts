import { describe, expect, it } from "vitest";
import { loadCorpus } from "./corpus";

describe("retrieval corpus scopes", () => {
  it("keeps documentation out of source-code retrieval", async () => {
    const corpus = await loadCorpus(1000, 150, "source");
    expect(corpus.chunks.length).toBeGreaterThan(0);
    expect(corpus.chunks.every((chunk) => chunk.sourceType !== "documentation")).toBe(true);
    expect(corpus.chunks.some((chunk) => chunk.source.endsWith(".ts"))).toBe(true);
  });

  it("offers documentation only through the explicit documentation scope", async () => {
    const corpus = await loadCorpus(1000, 150, "documentation");
    expect(corpus.chunks.length).toBeGreaterThan(0);
    expect(corpus.chunks.every((chunk) => chunk.sourceType === "documentation")).toBe(true);
    expect(corpus.chunks.some((chunk) => chunk.source === "docs/rag-interview-guide.md")).toBe(true);
  });
});
