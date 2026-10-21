import { Embeddings, EmbeddingsInterface } from "@langchain/core/embeddings";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import { digest } from "../runner/integrity";
import { callLLM } from "../llm/client";

export type EmbeddingProvider = "lexical" | "openai" | "ollama";
export type GenerationProvider = "disabled" | "legacy" | "openai" | "ollama";
export interface RagConfig {
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  embeddingBaseUrl: string;
  generationProvider: GenerationProvider;
  generationModel: string;
  generationBaseUrl: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minScore: number;
  timeoutMs: number;
}
function numberSetting(name: string, fallback: number, min: number, max: number, integer = true) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}
export function ragConfig(): RagConfig {
  const embeddingProvider = process.env.RAG_EMBEDDING_PROVIDER?.trim() || "lexical";
  const generationProvider = process.env.RAG_GENERATION_PROVIDER?.trim() || (process.env.LLM_ENABLED === "true" ? "legacy" : "disabled");
  if (!["lexical", "openai", "ollama"].includes(embeddingProvider)) throw new Error("Unknown RAG embedding provider");
  if (!["disabled", "legacy", "openai", "ollama"].includes(generationProvider)) throw new Error("Unknown RAG generation provider");
  const chunkSize = numberSetting("RAG_CHUNK_SIZE", 1000, 200, 2000);
  const chunkOverlap = numberSetting("RAG_CHUNK_OVERLAP", 150, 0, 500);
  if (chunkOverlap >= chunkSize) throw new Error("RAG overlap must be smaller than chunk size");
  return {
    embeddingProvider: embeddingProvider as EmbeddingProvider,
    embeddingModel: process.env.RAG_EMBEDDING_MODEL?.trim() || (embeddingProvider === "openai" ? "text-embedding-3-small" : embeddingProvider === "ollama" ? "nomic-embed-text" : "hashed-tokens-v1"),
    embeddingBaseUrl: process.env.RAG_EMBEDDING_BASE_URL?.trim() || (embeddingProvider === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1"),
    generationProvider: generationProvider as GenerationProvider,
    generationModel: process.env.RAG_GENERATION_MODEL?.trim() || process.env.LLM_MODEL || "",
    generationBaseUrl: process.env.RAG_GENERATION_BASE_URL?.trim() || (generationProvider === "ollama" ? "http://localhost:11434" : process.env.LLM_API_URL ?? "https://api.openai.com/v1"),
    chunkSize, chunkOverlap, topK: numberSetting("RAG_TOP_K", 4, 1, 8),
    minScore: numberSetting("RAG_MIN_SCORE", embeddingProvider === "lexical" ? 0.08 : 0.3, 0, 1, false),
    timeoutMs: numberSetting("RAG_TIMEOUT_MS", 20000, 1000, 60000),
  };
}
export const tokens = (text: string) => text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? [];
/** Reproducible offline baseline; never presented as learned semantic embeddings. */
export class LocalTokenEmbeddings extends Embeddings {
  constructor() { super({}); }
  private vector(text: string) {
    const vector = Array<number>(1024).fill(0);
    for (const token of tokens(text)) vector[parseInt(digest(token).slice(0, 8), 16) % vector.length] += 1;
    return vector;
  }
  async embedDocuments(texts: string[]) { return texts.map((text) => this.vector(text)); }
  async embedQuery(text: string) { return this.vector(text); }
}
class BatchedOllamaEmbeddings extends OllamaEmbeddings {
  override async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    // Keep each local request below the timeout while preserving corpus order.
    for (let i = 0; i < texts.length; i += 8) {
      vectors.push(...await super.embedDocuments(texts.slice(i, i + 8)));
    }
    return vectors;
  }
}
/** Credentials stay out of index identities, API responses and saved metadata. */
export function createEmbeddings(config: RagConfig): EmbeddingsInterface {
  if (config.embeddingProvider === "lexical") return new LocalTokenEmbeddings();
  if (config.embeddingProvider === "openai") {
    const apiKey = process.env.RAG_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Hosted embeddings require RAG_EMBEDDING_API_KEY or OPENAI_API_KEY");
    return new OpenAIEmbeddings({
      apiKey, model: config.embeddingModel, timeout: config.timeoutMs, maxRetries: 0, batchSize: 32,
      configuration: { baseURL: config.embeddingBaseUrl },
    });
  }
  return new BatchedOllamaEmbeddings({
    model: config.embeddingModel, baseUrl: config.embeddingBaseUrl, maxRetries: 0,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(config.timeoutMs) }),
  });
}
export async function generateAnswer(
  prompt: string,
  config: RagConfig,
  abortSignal?: AbortSignal
): Promise<string> {
  if (config.generationProvider === "disabled" || abortSignal?.aborted) return "";
  if (config.generationProvider === "legacy") return callLLM(prompt, config.timeoutMs, abortSignal);
  if (!config.generationModel) throw new Error("Set RAG_GENERATION_MODEL");

  const combinedSignal = abortSignal
    ? AbortSignal.any([AbortSignal.timeout(config.timeoutMs), abortSignal])
    : AbortSignal.timeout(config.timeoutMs);

  if (config.generationProvider === "ollama") {
    const model = new ChatOllama({
      baseUrl: config.generationBaseUrl,
      model: config.generationModel,
      temperature: 0,
      maxRetries: 0,
    });
    const response = await model.invoke(prompt, { signal: combinedSignal });
    return typeof response.content === "string" ? response.content : "";
  }
  const apiKey = process.env.RAG_GENERATION_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Hosted generation requires RAG_GENERATION_API_KEY");
  const model = new ChatOpenAI({
    apiKey,
    model: config.generationModel,
    temperature: 0,
    maxRetries: 0,
    timeout: config.timeoutMs,
    configuration: { baseURL: config.generationBaseUrl },
  });
  const response = await model.invoke(prompt, { signal: combinedSignal });
  return typeof response.content === "string" ? response.content : "";
}
