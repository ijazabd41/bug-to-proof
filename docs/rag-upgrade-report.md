# RAG portfolio upgrade report

> **POINT-IN-TIME REPORT:** Retained as implementation evidence for the RAG milestone. See [current status](current-project-status.md) for present product capability.

## Outcome

Implemented configurable LangChain embeddings and generation, a persistent local vector index, hybrid vector/BM25 retrieval, source-line provenance, citation validation and abstention, and retrieval evaluation. The existing bounded LangGraph debugging agent retains the independent baseline and same-test verification gates.

## Recorded validation

- 61/61 regression tests passed: `artifacts/rag-upgrade-regression.json`.
- API, dashboard, and MiniShop TypeScript checks passed: `artifacts/rag-upgrade-typecheck.log`.
- Both frontend production builds passed: `artifacts/rag-upgrade-build.log`.
- Real Chromium dashboard/API smoke passed: `artifacts/rag-upgrade-dashboard-smoke.json` and `artifacts/rag-upgrade-dashboard.png`.
- Three initial contract tests failed against the original RAG implementation and passed unchanged after the upgrade: `artifacts/rag-upgrade-baseline.json` and `artifacts/rag-upgrade-fixed.json`.
- The off-topic possessive-query regression failed before the token fix: `artifacts/rag-abstention-baseline.json`; the unchanged test passes in the full suite.
- Actual LangChain OpenAI and Ollama adapters were exercised with simulated HTTP responses: `artifacts/rag-provider-contracts.json`. These are adapter contract checks, not live model evaluations.

## Retrieval measurements

The fixed development smoke dataset contains ten answerable questions and two off-topic questions. At k=4, the local hashed-token vector baseline achieved hit rate and recall of 0.70 and MRR of 0.45. Adding BM25 with reciprocal rank fusion achieved hit rate and recall of 0.80 and MRR of 0.65. Both abstained on the two off-topic questions. Recorded p95 retrieval times were 84 ms and 64 ms respectively; these small-run timings are not general performance claims.

Results: `artifacts/rag-evaluation-lexical-vector.json` and `artifacts/rag-evaluation-lexical-hybrid.json`. Dataset: `data/evals/retrieval.json`.

## Design and practical limits

The default hashed-token embeddings are an explicit offline baseline, not learned semantic embeddings. OpenAI and Ollama embedding providers are implemented, but neither was evaluated with a live model in this run. Configure a provider and rerun `npm run rag:evaluate` before making semantic-quality claims.

The index is a local JSON artifact restored into LangChain MemoryVectorStore with exact cosine search. Source/configuration changes rebuild document embeddings; this is not an incremental or production-scale vector database. The benchmark is a small development smoke set, not a held-out evaluation. Citation validation verifies provenance, not factual entailment. Provider failures remain explicit, and generated prose cannot establish reproduction or patch verification.

See `docs/rag-interview-guide.md` for provider setup, architecture, tradeoffs, evaluation definitions, and an interview pitch.
