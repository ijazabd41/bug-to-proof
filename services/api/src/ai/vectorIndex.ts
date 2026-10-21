import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { digest } from "../runner/integrity";
import { WORKSPACE_ROOT } from "../utils/paths";
import { loadCorpus, CorpusChunk, type CorpusScope } from "./corpus";
import { createEmbeddings, RagConfig } from "./providers";

export interface IndexResult {
  store: MemoryVectorStore; chunks: CorpusChunk[]; fingerprint: string;
  cacheHit: boolean; indexPath: string; buildMs: number;
}
interface SavedIndex {
  version: number; fingerprint: string; chunks: CorpusChunk[]; vectors: number[][]; checksum: string;
}
const inFlight = new Map<string, Promise<IndexResult>>();
const indexRoot = path.join(WORKSPACE_ROOT, "data", "rag-index");
export function validVectors(vectors: number[][], count: number, dimensions?: number): boolean {
  return Array.isArray(vectors) && vectors.length === count && count > 0 &&
    vectors.every((vector) => Array.isArray(vector) && vector.length === (dimensions ?? vectors[0]?.length) &&
      vector.length > 0 && vector.every(Number.isFinite) && vector.some((n) => n !== 0));
}
export async function loadIndex(
  config: RagConfig, embeddings: EmbeddingsInterface = createEmbeddings(config),
  directory = indexRoot,
  scope: CorpusScope = "source",
): Promise<IndexResult> {
  const start = Date.now();
  const corpus = await loadCorpus(config.chunkSize, config.chunkOverlap, scope);
  const fingerprint = digest(JSON.stringify({
    version: 2, scope, corpus: corpus.fingerprint, provider: config.embeddingProvider,
    model: config.embeddingModel, endpoint: digest(config.embeddingBaseUrl),
  }));
  const indexPath = path.join(directory, fingerprint + ".json");
  const lockKey = indexPath;
  const existing = inFlight.get(lockKey);
  if (existing) return existing;
  const build = async (): Promise<IndexResult> => {
    let vectors: number[][] | undefined;
    let cacheHit = false;
    try {
      const saved: SavedIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      if (saved.version === 1 && saved.fingerprint === fingerprint &&
        JSON.stringify(saved.chunks) === JSON.stringify(corpus.chunks) &&
        validVectors(saved.vectors, corpus.chunks.length) &&
        saved.checksum === digest(JSON.stringify({ chunks: saved.chunks, vectors: saved.vectors }))) {
        vectors = saved.vectors; cacheHit = true;
      }
    } catch { /* Missing/corrupt index is rebuilt; provider failures are not hidden. */ }
    if (!vectors) {
      vectors = await embeddings.embedDocuments(corpus.chunks.map((chunk) => chunk.content));
      if (!validVectors(vectors, corpus.chunks.length)) throw new Error("Embedding provider returned invalid vectors");
      const saved: SavedIndex = {
        version: 1, fingerprint, chunks: corpus.chunks, vectors,
        checksum: digest(JSON.stringify({ chunks: corpus.chunks, vectors })),
      };
      fs.mkdirSync(directory, { recursive: true });
      const temporary = indexPath + "." + randomUUID() + ".tmp";
      try {
        fs.writeFileSync(temporary, JSON.stringify(saved));
        fs.renameSync(temporary, indexPath);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
    const store = new MemoryVectorStore(embeddings);
    await store.addVectors(vectors, corpus.chunks.map((chunk) => new Document({ pageContent: chunk.content, metadata: chunk })));
    return { store, chunks: corpus.chunks, fingerprint, cacheHit, indexPath, buildMs: Date.now() - start };
  };
  const promise = build();
  inFlight.set(lockKey, promise);
  try { return await promise; } finally { inFlight.delete(lockKey); }
}
