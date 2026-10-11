# Local RAG and debugging agent

> **LEGACY ARCHITECTURE:** This document describes the earlier seeded case-001 agent. See the [documentation index](README.md), [current status](current-project-status.md), and [dynamic repair plan](../plans/dynamic-ai-repair-plan.md) for the current system.

The LangChain pipeline ingests allowlisted code and documentation, creates source-line-aware chunks, and persists model-specific vectors. It supports OpenAI hosted learned embeddings, local Ollama embeddings, and an explicit lexical offline baseline. Hybrid retrieval combines vector similarity and BM25 using rank fusion. The selected index is reused when source/config hashes match.

Generation is separately configurable as disabled, OpenAI-compatible, Ollama, or the legacy client. Model JSON and citations are validated against retrieved chunks; invalid output falls back to excerpts. No relevant sources causes abstention. Returned telemetry identifies the provider, corpus fingerprint, cache reuse and timings. Model output remains advisory, and citation validation does not prove factual support. No secret files or arbitrary request-selected paths are ingested.

See [RAG architecture, configuration and interview guide](rag-interview-guide.md) for setup, evaluation and tradeoffs.
The LangGraph workflow follows:
retrieve -> reproduce -> propose -> apply (explicit opt-in) -> verify.
Conditional edges stop on infrastructure errors, a passing baseline, changed inputs, or unsupported source. Each browser run uses the evidence runner. Only a labelled assertion failure with structured expected/actual evidence is a valid baseline. Before/after fingerprints bind test files, helper files, config, shared test IDs, runtime version and Playwright version. Executed test identities must also match. A missing legacy fingerprint or altered report invalidates proof.

POST /api/ai/ask accepts {"question":"How is cart total computed?"}.
POST /api/ai/cases/case-001/debug accepts {"applyPatch":false} by default.
Inspect the returned patch, source context, graph events, and report artifact.
{"applyPatch":true} repeats the baseline, applies the allowlisted cart repair, and runs the unchanged tests again.

The debugging agent supports the seeded cart bug only. It is a bounded demo repair workflow, not a general autonomous coding agent. The model cannot execute shell commands, select patch paths, write code, or set proof status. Applying a patch checks that the original source and baseline are unchanged. It preserves an original source snapshot and records a report under artifacts/agent/<runId>. Failed verification leaves the patch visible for inspection.

Run with Node 22 or newer. No model key is needed for offline retrieval or graph/evidence tests.
Start MiniShop before a browser run. Use npm run evidence:before before changing demo source and npm run evidence:after afterward. Those commands must show ASSERTION_FAILED then PASSED with matching fingerprints; a passing baseline is not a reproduced bug.

Limitations: the local index uses exact in-memory search; live semantic quality has not been evaluated. There is no checkpoint/resume, arbitrary patch synthesis, production authentication, or concurrent multi-process target isolation. Generated prose is not evidence. Baseline and report hashes detect accidental changes; this local demo is not a cryptographically trusted execution system. Demo reset clears case evidence and claims, but does not revert source code.

To repeat the demo after a verified fix, explicitly run npm run demo:seed, then npm run agent:demo while MiniShop is running. The seed command restores the known buggy cart expression; it does not run model-provided code.
