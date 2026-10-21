import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preflightReproductionProvider } from "./generationProvider";

describe("reproduction generation preflight", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("checks that the configured local model is installed", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "ollama");
    vi.stubEnv("RAG_GENERATION_MODEL", "fixture");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: "fixture:latest" }] }), { status: 200 }));
    expect(await preflightReproductionProvider()).toMatchObject({ ready: true, provider: "ollama", code: "READY" });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("http://localhost:11434/api/tags");
  });

  it("reports an absent local model without sending a generation request", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "ollama");
    vi.stubEnv("RAG_GENERATION_MODEL", "missing");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    expect(await preflightReproductionProvider()).toMatchObject({ ready: false, code: "MODEL_NOT_INSTALLED" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("stops before any request when hosted credentials are missing", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "openai");
    vi.stubEnv("RAG_GENERATION_MODEL", "fixture");
    vi.stubEnv("RAG_GENERATION_API_KEY", "");
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await preflightReproductionProvider()).toMatchObject({ ready: false, code: "CREDENTIALS_MISSING" });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
