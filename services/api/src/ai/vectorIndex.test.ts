import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { ARTIFACTS_DIR } from "../utils/paths";
import { ragConfig, LocalTokenEmbeddings } from "./providers";
import { loadIndex } from "./vectorIndex";
import { loadCorpus } from "./corpus";
import { validateGenerated } from "./rag";
import type { SourceChunk } from "./retrieval";
afterEach(() => vi.unstubAllEnvs());
const lexicalConfig = () => {
  vi.stubEnv("RAG_EMBEDDING_PROVIDER", "lexical");
  vi.stubEnv("RAG_GENERATION_PROVIDER", "disabled");
  return ragConfig();
};
describe("persistent vector index", () => {
  it("reuses document embeddings, invalidates model identity, and rebuilds corrupt indexes", async () => {
    const config = lexicalConfig();
    const dir = fs.mkdtempSync(path.join(ARTIFACTS_DIR, "rag-index-test-"));
    const embeddings = new LocalTokenEmbeddings();
    const spy = vi.spyOn(embeddings, "embedDocuments");
    try {
      const first = await loadIndex(config, embeddings, dir);
      const second = await loadIndex(config, embeddings, dir);
      expect(first.cacheHit).toBe(false); expect(second.cacheHit).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      const changed = await loadIndex({ ...config, embeddingModel: "another-model-version" }, embeddings, dir);
      expect(changed.fingerprint).not.toBe(first.fingerprint);
      expect(spy).toHaveBeenCalledTimes(2);
      fs.writeFileSync(first.indexPath, "corrupted");
      expect((await loadIndex(config, embeddings, dir)).cacheHit).toBe(false);
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
      } catch {}
    }
  });
  it("invalidates the saved index when source content changes", async () => {
    const config = lexicalConfig();
    const dir = fs.mkdtempSync(path.join(ARTIFACTS_DIR, "rag-index-test-"));
    const original = fs.readFileSync;
    try {
      const first = await loadIndex(config, new LocalTokenEmbeddings(), dir);
      const spy = vi.spyOn(fs, "readFileSync").mockImplementation(((file: any, ...args: any[]) => {
        const content = (original as any)(file, ...args);
        return String(file).endsWith("cartStore.ts") ? String(content) + "\n// source revision test" : content;
      }) as any);
      try {
        const second = await loadIndex(config, new LocalTokenEmbeddings(), dir);
        expect(second.fingerprint).not.toBe(first.fingerprint);
        expect(second.cacheHit).toBe(false);
      } finally { spy.mockRestore(); }
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
      } catch {}
    }
  });
  it("does not save invalid provider vectors", async () => {
    const dir = fs.mkdtempSync(path.join(ARTIFACTS_DIR, "rag-index-test-"));
    try {
      await expect(loadIndex(lexicalConfig(), {
        embedDocuments: async (texts) => texts.map(() => [NaN]), embedQuery: async () => [NaN],
      }, dir)).rejects.toThrow(/invalid vectors/);
      expect(fs.readdirSync(dir)).toHaveLength(0);
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
      } catch {}
    }
  });
});
describe("source provenance", () => {
  it("chunks retain exact source lines and hashes; secrets stay outside the corpus", async () => {
    const corpus = await loadCorpus(1000, 150);
    expect(corpus.chunks.length).toBeGreaterThan(10);
    for (const chunk of corpus.chunks) {
      const original = fs.readFileSync(path.join(process.cwd(), chunk.source), "utf8").split("\n");
      const span = original.slice(chunk.startLine - 1, chunk.endLine).join("\n");
      expect(span).toContain(chunk.content);
      expect(chunk.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
      expect(chunk.source).not.toContain(".env");
      expect(chunk.source).not.toContain("node_modules");
    }
  });
});
const source: SourceChunk = {
  source: "cart.ts", sourceType: "source", chunkId: "known", sourceHash: "hash", startLine: 1, endLine: 2,
  content: "total = price * quantity", score: 1, lexicalScore: 1, rankScore: 1,
};
describe("generated-answer provenance (model responses simulated)", () => {
  it("accepts a supported citation and rejects invented inline references", () => {
    expect(validateGenerated(JSON.stringify({ answer: "Total includes quantity [known].", citations: ["known"], abstained: false }), [source])?.citations).toEqual(["known"]);
    expect(validateGenerated(JSON.stringify({ answer: "Total [invented].", citations: ["known"], abstained: false }), [source])).toBeNull();
  });
  it("accepts abstention and rejects unsupported citation lists", () => {
    expect(validateGenerated(JSON.stringify({ answer: "Unknown", citations: [], abstained: true }), [source])?.abstained).toBe(true);
    expect(validateGenerated(JSON.stringify({ answer: "Unknown", citations: ["known"], abstained: true }), [source])).toBeNull();
    expect(validateGenerated(JSON.stringify({ answer: "Known", citations: [], abstained: false }), [source])).toBeNull();
  });
});
