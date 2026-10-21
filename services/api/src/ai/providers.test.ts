import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbeddings, ragConfig } from "./providers";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("LangChain provider contracts (HTTP responses simulated)", () => {
  it("uses the hosted embeddings integration with independent credentials", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "openai");
    vi.stubEnv("RAG_EMBEDDING_API_KEY", "test-placeholder");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    const fetchStub = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string);
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      return new Response(JSON.stringify({
        object: "list", model: body.model,
        data: inputs.map((_: unknown, index: number) => ({ object: "embedding", index, embedding: [1, 0.5, 0.25] })),
        usage: { prompt_tokens: 2, total_tokens: 2 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchStub);
    const embeddings = createEmbeddings(ragConfig());
    expect(await embeddings.embedDocuments(["cart total", "cart quantity"])).toHaveLength(2);
    expect(await embeddings.embedQuery("sum prices")).toEqual([1, 0.5, 0.25]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
  it("uses the Ollama integration without a hosted key", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "ollama");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({
      model: "nomic-embed-text", embeddings: [[1, 0.5, 0.25]],
      total_duration: 1, load_duration: 1, prompt_eval_count: 1,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchStub);
    const embeddings = createEmbeddings(ragConfig());
    expect(await embeddings.embedQuery("cart total")).toEqual([1, 0.5, 0.25]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
  it("embeds Ollama documents in bounded batches while preserving order", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "ollama");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    const batchSizes: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string);
      batchSizes.push(body.input.length);
      return new Response(JSON.stringify({
        model: body.model,
        embeddings: body.input.map((value: string) => [Number(value), 0.5]),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const embeddings = createEmbeddings(ragConfig());
    const vectors = await embeddings.embedDocuments(Array.from({ length: 9 }, (_, i) => String(i + 1)));
    expect(batchSizes).toEqual([8, 1]);
    expect(vectors.map((vector) => vector[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("requires the semantic provider key and rejects invalid chunk settings", () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "openai");
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    vi.stubEnv("RAG_EMBEDDING_API_KEY", ""); vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => createEmbeddings(ragConfig())).toThrow(/require/);
    vi.stubEnv("RAG_CHUNK_SIZE", "200"); vi.stubEnv("RAG_CHUNK_OVERLAP", "200");
    expect(() => ragConfig()).toThrow(/overlap/);
  });
});
