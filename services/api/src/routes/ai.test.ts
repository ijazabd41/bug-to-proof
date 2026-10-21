import request from "supertest";
import { describe, expect, it, vi } from "vitest";
vi.mock("../llm/client", () => ({ callLLM: vi.fn().mockResolvedValue("") }));
import app from "../index";
describe("AI API", () => {
  it("returns offline RAG with sources", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
    try {
      const response = await request(app).post("/api/ai/ask").send({ question: "cart total price quantity", scope: "source" });
      expect(response.status).toBe(200);
      expect(response.body.mode).toBe("extractive");
      expect(response.body.scope).toBe("source");
      expect(response.body.sources.length).toBeGreaterThan(0);
      expect(response.body.sources.every((source: { sourceType: string }) => source.sourceType !== "documentation")).toBe(true);
    } finally { vi.unstubAllEnvs(); }
  });
  it("rejects unknown retrieval scopes", async () => {
    const response = await request(app).post("/api/ai/ask").send({ question: "cart total", scope: "everything" });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/scope/i);
  });
  it("builds and reuses the local index through the API", async () => {
    const first = await request(app).post("/api/ai/index").send({});
    const second = await request(app).post("/api/ai/index").send({});
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(first.body.indexFingerprint).toBe(second.body.indexFingerprint);
    expect(second.body.cacheHit).toBe(true);
  }, 15000);
  it("reports configuration without returning credentials", async () => {
    const response = await request(app).get("/api/ai/status");
    expect(response.status).toBe(200);
    expect(response.body.embeddingProvider).toBe("lexical");
    expect(response.body.chunks).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toMatch(/apiKey|API_KEY|baseUrl/i);
  });
  it("returns a retrieval infrastructure error instead of generated prose on misconfiguration", async () => {
    vi.stubEnv("RAG_EMBEDDING_PROVIDER", "unknown");
    try {
      const response = await request(app).post("/api/ai/ask").send({ question: "cart total" });
      expect(response.status).toBe(503);
      expect(response.body.code).toBe("RAG_UNAVAILABLE");
    } finally { vi.unstubAllEnvs(); }
  });
  it("validates input and does not interpret bug text as commands", async () => {
    expect((await request(app).post("/api/ai/ask").send({ question: 10 })).status).toBe(400);
    expect((await request(app).post("/api/ai/cases/bad_id/debug").send({ applyPatch: true })).status).toBe(400);
    expect((await request(app).post("/api/ai/cases/nonexistent/debug").send({})).status).toBe(404);
  });
});
