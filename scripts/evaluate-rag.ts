import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../services/api/src/utils/paths";
interface EvaluationCase { id: string; question: string; relevantSources: string[]; }
async function main() {
  loadEnv({ path: path.join(WORKSPACE_ROOT, ".env") });
  const { ragConfig } = await import("../services/api/src/ai/providers");
  const { retrieve } = await import("../services/api/src/ai/retrieval");
  const config = ragConfig();
  const dataset: EvaluationCase[] = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/evals/retrieval.json"), "utf8").replace(/^\uFEFF/, ""));
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  for (const strategy of ["vector", "hybrid"] as const) {
    const rows = [];
    for (const item of dataset) {
      const result = await retrieve(item.question, config, strategy);
      const ranked = result.sources.map((source) => source.source);
      const relevant = new Set(item.relevantSources);
      const found = new Set(ranked.filter((source) => relevant.has(source)));
      const rank = ranked.findIndex((source) => relevant.has(source));
      rows.push({
        ...item, rankedSources: ranked, retrievedChunkIds: result.sources.map((source) => source.chunkId),
        hit: rank >= 0, reciprocalRank: rank >= 0 ? 1 / (rank + 1) : 0,
        recall: relevant.size ? found.size / relevant.size : null,
        correctAbstention: relevant.size ? null : ranked.length === 0, telemetry: result.telemetry,
      });
    }
    const answerable = rows.filter((row) => row.relevantSources.length);
    const offTopic = rows.filter((row) => !row.relevantSources.length);
    const latency = rows.map((row) => row.telemetry.retrievalMs).sort((a, b) => a - b);
    const summary = {
      provider: config.embeddingProvider, model: config.embeddingModel, strategy, topK: config.topK,
      cases: rows.length, answerableCases: answerable.length, offTopicCases: offTopic.length,
      hitAtK: answerable.filter((row) => row.hit).length / answerable.length,
      recallAtK: answerable.reduce((n, row) => n + row.recall!, 0) / answerable.length,
      mrrAtK: answerable.reduce((n, row) => n + row.reciprocalRank, 0) / answerable.length,
      offTopicAbstentionRate: offTopic.filter((row) => row.correctAbstention).length / offTopic.length,
      latencyP95Ms: latency[Math.ceil(latency.length * 0.95) - 1],
      embeddingKind: config.embeddingProvider === "lexical" ? "lexical baseline" : "learned embeddings",
      limitations: "Small source-level smoke benchmark. Does not measure generation accuracy, factual entailment or universal abstention.",
    };
    const output = path.join(ARTIFACTS_DIR, `rag-evaluation-${config.embeddingProvider}-${strategy}.json`);
    fs.writeFileSync(output, JSON.stringify({ runAt: new Date().toISOString(), summary, rows }, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  }
}
main().catch(() => {
  console.error("RAG evaluation failed. Check the configured embedding provider. No successful score is reported.");
  process.exitCode = 1;
});
