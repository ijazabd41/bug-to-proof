import { createEmbeddings, ragConfig, tokens, RagConfig } from "./providers";
import { loadIndex, validVectors } from "./vectorIndex";
import { CorpusChunk } from "./corpus";
import type { CorpusScope } from "./corpus";
export interface SourceChunk extends CorpusChunk { score: number; rankScore: number; lexicalScore: number; }
export interface RetrievalResult {
  sources: SourceChunk[];
  telemetry: { provider: string; model: string; strategy: "vector" | "hybrid"; indexFingerprint: string;
    cacheHit: boolean; corpusChunks: number; retrievalMs: number; topK: number };
}
const STOP = new Set("a an the what why how when where which is are was were be been do does did can could should would will of to in on at for and or with from this that it its me my your our explain please about only".split(" "));
const terms = (text: string) => tokens(text).filter((token) => token.length > 1 && !STOP.has(token));
/** BM25 protects exact code identifiers; vector retrieval handles paraphrases. */
export function bm25Scores(query: string, chunks: CorpusChunk[]): number[] {
  const queryTerms = [...new Set(terms(query))];
  const documents = chunks.map((chunk) => terms(chunk.content));
  const averageLength = documents.reduce((n, doc) => n + doc.length, 0) / Math.max(1, documents.length);
  const df = new Map(queryTerms.map((term) => [term, documents.filter((doc) => doc.includes(term)).length]));
  return documents.map((doc) => queryTerms.reduce((score, term) => {
    const frequency = doc.filter((word) => word === term).length;
    if (!frequency) return score;
    const idf = Math.log(1 + (documents.length - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
    return score + idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.length / Math.max(1, averageLength)));
  }, 0));
}
export async function retrieve(
  query: string, config: RagConfig = ragConfig(), strategy: "vector" | "hybrid" = "hybrid", scope: CorpusScope = "source",
): Promise<RetrievalResult> {
  if (!query.trim() || query.length > 4000) throw new Error("Query must contain 1 to 4000 characters");
  const start = Date.now();
  const embeddings = createEmbeddings(config);
  const index = await loadIndex(config, embeddings, undefined, scope);
  const telemetry = {
    provider: config.embeddingProvider, model: config.embeddingModel, strategy, indexFingerprint: index.fingerprint,
    cacheHit: index.cacheHit, corpusChunks: index.chunks.length, retrievalMs: 0, topK: config.topK,
  };
  if (!terms(query).length) return { sources: [], telemetry: { ...telemetry, retrievalMs: Date.now() - start } };
  const queryVector = await embeddings.embedQuery(query);
  if (!validVectors([queryVector], 1, index.store.memoryVectors[0].embedding.length)) throw new Error("Invalid query embedding dimensions or values");
  const candidateCount = Math.min(index.chunks.length, config.topK * 3);
  const matches = await index.store.similaritySearchVectorWithScore(queryVector, candidateCount);
  const lexical = bm25Scores(query, index.chunks);
  const keywordRanks = index.chunks.map((chunk, index) => ({ chunk, score: lexical[index] }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, candidateCount);
  const vectorScores = new Map(matches.map(([document, score]) => [document.metadata.chunkId as string, score]));
  const ranks = new Map<string, number>();
  const eligible = new Set<string>();
  matches.forEach(([document, score], rank) => {
    const id = document.metadata.chunkId as string;
    const chunkIndex = index.chunks.findIndex((chunk) => chunk.chunkId === id);
    if (score >= config.minScore && (config.embeddingProvider !== "lexical" || lexical[chunkIndex] > 0)) {
      eligible.add(id); ranks.set(id, 1 / (60 + rank + 1));
    }
  });
  if (strategy === "hybrid") keywordRanks.forEach(({ chunk }, rank) => {
    eligible.add(chunk.chunkId);
    ranks.set(chunk.chunkId, (ranks.get(chunk.chunkId) ?? 0) + 1 / (60 + rank + 1));
  });
  const sources = index.chunks.map((chunk, position) => ({
    ...chunk, score: vectorScores.get(chunk.chunkId) ?? 0,
    rankScore: ranks.get(chunk.chunkId) ?? 0, lexicalScore: lexical[position],
  })).filter((chunk) => eligible.has(chunk.chunkId))
    .sort((a, b) => strategy === "vector" ? b.score - a.score : b.rankScore - a.rankScore)
    .slice(0, config.topK);
  return { sources, telemetry: { ...telemetry, retrievalMs: Date.now() - start } };
}
