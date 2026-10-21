# RAG architecture and interview guide

> **REFERENCE GUIDE:** RAG supports source retrieval and proposal context; it does not establish test correctness or automatic reproduction. See [current status](current-project-status.md).

Updated 20 October 2026.

## Recommended portfolio configuration

Use the measured lexical hybrid configuration for the portfolio demo: BM25 plus the deterministic `hashed-tokens-v1` index, fused by reciprocal-rank fusion. It runs offline and needs no embedding account. A learned embedding model is an optional comparison, not a requirement for this small allowlisted repository.

For semantic retrieval, set RAG_EMBEDDING_PROVIDER=openai and RAG_EMBEDDING_MODEL=text-embedding-3-small. The embedding endpoint defaults to https://api.openai.com/v1. Store the embedding key in RAG_EMBEDDING_API_KEY in your local .env. Do not assume a chat-provider key works for embedding APIs. OpenAI documents this model and cosine-based search in its [embedding guide](https://developers.openai.com/api/docs/guides/embeddings).

For chat generation, set RAG_GENERATION_PROVIDER=openai, RAG_GENERATION_MODEL to your existing provider's model, and RAG_GENERATION_BASE_URL to that provider's OpenAI-compatible API URL. The adapter accepts RAG_GENERATION_API_KEY, falling back to the existing LLM_API_KEY. Embedding and generation models are separate dependencies.

For a fully local semantic configuration, select ollama, set RAG_EMBEDDING_MODEL=nomic-embed-text and RAG_EMBEDDING_BASE_URL=http://localhost:11434, then configure an installed local chat model using RAG_GENERATION_PROVIDER=ollama and RAG_GENERATION_MODEL. Ollama must be installed and both selected models pulled first. See the [LangChain Ollama embedding integration](https://github.com/langchain-ai/docs/blob/main/src/oss/javascript/integrations/embeddings/ollama.mdx).

The code default is lexical retrieval plus disabled generation so tests run without accounts or models. This is a reproducible lexical baseline, not semantic RAG. Generation can be configured separately for an interactive demo.

## Architecture

1. Ingest an explicit list of repository code and documentation. Resolve real paths and exclude .env, node_modules, historical case records and arbitrary request-selected files.
2. Split with LangChain RecursiveCharacterTextSplitter: 1000 characters, 150-character overlap by default. Each chunk carries a source path, original line span, full source hash and unique chunk ID.
3. Embed through LangChain OpenAIEmbeddings or OllamaEmbeddings. A deterministic hashed-token provider is retained for the offline baseline.
4. Persist chunks and vectors to a content-addressed local JSON index. Index identity includes source/config hashes and the embedding provider, model and endpoint identity. A checksum and vector validation protect against corrupt caches. Concurrent requests for the same index share a build.
5. Search vectors with LangChain MemoryVectorStore using exact cosine similarity. Rank exact lexical matches with BM25. Fuse ranks with reciprocal-rank fusion and return the top four chunks by default.
6. Generate through a LangChain prompt and runnable using the selected chat model. Treat source excerpts and questions as untrusted input.
7. Validate the model JSON and citation IDs. Unknown citations, malformed output and unavailable generation fall back to source excerpts. No retrieved evidence causes abstention. Model-provided abstention is accepted without fabricated claims.
8. Return source snippets, original line spans, citations, warnings, provider information, index fingerprints, cache status and timings to the dashboard.

The model cannot execute commands, edit files or mark a bug reproduced/verified. LangGraph consumes RAG context as advisory data; browser evidence gates still control patch verification.

## Explain your decisions

**Why RAG rather than fine-tuning?**
The problem is answering questions about changing source code. Retrieval supplies current code without retraining. Fine-tuning would not reliably keep answers aligned with changing files.

**Why overlap?**
Functions and explanations can cross a chunk boundary. A modest overlap preserves nearby context, at the cost of more chunks and duplicate retrieval. These character settings are initial defaults, not proven optima; vary them on a development set.

**Why hybrid retrieval?**
Code questions mix natural-language paraphrases with exact names such as validBaseline or reportHash. Learned vectors can help with meaning, while BM25 preserves identifier matches. RRF combines rankings without pretending cosine and BM25 scores have the same scale. Compare this against vector-only retrieval before claiming a gain.

**Why a local JSON index?**
The corpus is small enough for exact in-memory search. Persisting vectors avoids paying to re-embed unchanged code after every request or restart. This is a persistent local vector index, not a production vector database. Search is linear in chunk count and vector dimension; move to a suitable vector database when measured scale or concurrency requires it.

**How do you handle source changes?**
Read and hash the allowed sources. Changed content, chunk settings or embedding identity selects a new index. The current implementation rebuilds all document vectors on a corpus change; it does not do incremental per-chunk embedding updates.

**How do you prevent hallucinations?**
Only known retrieved chunk IDs are accepted as citations. Answers with invalid grounding fall back to excerpts. This checks provenance, not factual entailment: a model can still make a wrong claim while citing a real source. Evaluate factual support separately and keep generated explanations advisory.

**Why distinguish model failures from bug proof?**
Retrieval or generation errors are infrastructure failures, not reproduced application bugs. Only the evidence runner's valid failing baseline followed by the same passing test can verify a patch.

## Evaluate it honestly

Run npm run rag:evaluate after configuring the embedding provider. It compares vector-only and hybrid retrieval on data/evals/retrieval.json and saves results to artifacts/rag-evaluation-<provider>-<strategy>.json.

The twelve labelled cases include ten repository questions with expected source paths and two off-topic questions. Report:
- Hit@4: fraction of answerable questions retrieving any relevant source.
- Recall@4: fraction of labelled relevant source paths retrieved, deduplicating chunks.
- MRR@4: mean reciprocal rank of the first relevant result.
- Off-topic abstention rate: fraction of the two unsupported questions returning no sources.
- Retrieval p95 latency, with per-question cache status and corpus fingerprint.

The local development benchmark has recorded both configurations on the same 12 questions (10 answerable, 2 off-topic):

| Retrieval setup | Hit@4 | MRR@4 | Off-topic abstention |
| --- | ---: | ---: | ---: |
| BM25 + hashed-token index, hybrid | 10/10 | 0.933 | 2/2 |
| BM25 + local Ollama `nomic-embed-text`, hybrid | 10/10 | 0.817 | 0/2 |

These are local, Git-ignored artifacts from 16 October 2026: `artifacts/rag-evaluation-lexical-hybrid.json` and `artifacts/rag-evaluation-ollama-hybrid.json`. The learned model did not improve this small benchmark's hit rate and lost both off-topic abstentions. This is a development smoke benchmark, not a representative held-out evaluation. It does not measure generated answer accuracy, factual support, cost, or production latency. Neither retrieval score establishes arbitrary-report reproduction reliability.

## A concise interview pitch

"I built a source-grounded debugging assistant with LangChain RAG and a bounded LangGraph workflow. I ingest allowlisted code, chunk it with source-line provenance, persist model-specific embeddings, and combine vector search with BM25 using rank fusion. Generated answers must cite retrieved chunks, and I benchmark retrieval rather than assume it works. The model provides context; a separate browser evidence runner requires a genuine failing baseline and the same passing test before claiming a bug is fixed."

## Run and inspect

- npm run dev starts the local services.
- GET /api/ai/status reports non-secret RAG configuration and corpus size without calling a model.
- POST /api/ai/index builds or reuses the selected index.
- POST /api/ai/ask accepts a question and returns an answer with provenance and telemetry.
- npm run rag:evaluate records retrieval comparisons for the configured embedding provider.
- npm run test:unit, npm run typecheck and npm run build validate the implementation.
- The dashboard shows whether retrieval is lexical or semantic, returned source lines, cache status and generation warnings.

Remaining work before broader retrieval claims: a larger held-out question set, factual-support grading, query cancellation, incremental indexing, multi-process cache coordination, index retention and production authentication.
