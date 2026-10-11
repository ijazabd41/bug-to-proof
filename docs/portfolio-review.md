# Portfolio review and verification report

> **HISTORICAL REVIEW:** This assessment predates the current dynamic repair and dashboard milestones. See [current status](current-project-status.md).

Reviewed locally on 8 October 2026.

This is now a credible, bounded AI engineering portfolio prototype: a full-stack debugging workflow with LangChain retrieval, LangGraph orchestration, and browser evidence gates. Present it as an evidence-first demo for one supported repair. Generated explanations cannot declare success: the evidence runner owns reproduced and verified outcomes.

## Findings and changes

| Finding | Root cause | Change |
| --- | --- | --- |
| Infrastructure errors became reproduced bugs | Reproduction used only !passed | Explicit outcomes; only instrumented behavior assertions reproduce a bug |
| A pass could verify without a failed baseline | Verification checked only state and an after-run boolean | Require a saved assertion failure, matching manifest, report hash and current fingerprint |
| Changed tests could verify a patch | No input or test identity comparison | Hash specs, helpers, config, shared IDs, runtime and Playwright version; compare executed identities |
| Malformed reporter output could pass | Exit zero remained a pass after parse errors | Reject invalid reports, zero tests, skipped/interrupted/timeouts, setup errors and contradictory results |
| Historical artifacts could appear current | Fixed paths and IDs; missing nested trace lookup | Unique run directories and IDs; reporter-backed attachments; UI selects the current run |
| Seed records looked like real evidence | Invented historical runs and artifact references | READY_TO_REPRODUCE seed without evidence; historical samples used only as synthetic test fixtures |
| Dashboard overclaimed success | Any failure meant reproduced; any after pass meant fixed | Outcome-aware labels and verified-only fix claims |
| Frontend tests had environment gaps | Current Vitest did not use the legacy workspace declaration | Explicit projects and jsdom setup; repaired Product fixtures |
| Cart total ignored later items | items[0].price | Minimal sum of price times quantity after a recorded failing baseline |

Changed areas: API runner, reproduction/verification/case/reset routes, shared run types, AI modules/routes, dashboard assistant/evidence components, MiniShop cart calculation, test configuration, demo scripts, and documentation. Existing local edits were preserved. No deploy or merge was performed.

## Recorded checks

- Seven focused evidence tests failed against original runner/routes, then passed against the fix with the same assertions. Baseline was repeated after moving the legacy fixture.
- Two dashboard label tests failed as assertions against the original UI and pass after the fix. Earlier setup errors were not treated as reproduced bugs.
- Final unit suite: all 43 tests passed, no failed suites. Coverage includes local RAG, AI API inputs, graph branch gates, evidence classification/integrity, frontend checks, and cart quantity/removal.
- All three app typechecks and both frontend builds passed.
- A real Chromium dashboard smoke check rendered the assistant and returned offline excerpts. This is separate from case proof.
- The real graph used the evidence runner before editing original cart source, applied the minimal fix, and ran the identical spec afterward. Both browser tests failed on $10.00 versus $30.00 before and passed afterward. Fingerprints and identities match.
- Browser baseline verification was repeated when assertion instrumentation or whitespace changed.

Evidence:
- [Original evidence-gate failures](../artifacts/portfolio-baseline.json)
- [Original dashboard label failures](../artifacts/portfolio-ui-baseline.json)
- [Final regression results](../artifacts/portfolio-regression.json)
- [Typecheck output](../artifacts/portfolio-typecheck.log)
- [Build output](../artifacts/portfolio-build.log)
- [Dashboard smoke result](../artifacts/portfolio-dashboard-smoke.json)
- [Dashboard screenshot](../artifacts/portfolio-dashboard.png)
- [Agent execution summary](../artifacts/portfolio-agent.json)

The first classifier attempt conservatively returned INFRASTRUCTURE_ERROR because Playwright serialized errors omit matcherResult. It was not used as a valid baseline. Structured expected/actual attachments were added and the baseline was repeated.

## Portfolio claims and limits

Accurate description: "Built a local debugging prototype combining source-cited LangChain retrieval and a bounded LangGraph repair workflow. Added fail-closed browser evidence classification and baseline/test identity gates; demonstrated a failing cart test becoming a pass with identical test inputs."

Offline retrieval uses hashed lexical vectors and an in-memory store, not learned semantic search. The existing optional model client is called through a LangChain prompt/runnable; live model quality was not evaluated. The graph supports the cart repair rather than arbitrary code synthesis. There is no persistent checkpoint/resume or multi-process target isolation. Hashes detect accidental evidence changes, not a hostile local operator.

Useful next portfolio improvements: a labelled retrieval evaluation set, learned embeddings with measured retrieval gains, checkpoint/resume, and a second supported bug with a different root cause. Keep the tool permissions and evidence gates when expanding.

## Current proof
Case: VERIFIED. Baseline: ASSERTION_FAILED. After patch: PASSED.
Matching test fingerprint: 0881ec9542058856b644c2ef5425d4c8ae544e33a68f25fea917f02b214d0677.
[Complete final agent report](../artifacts/agent/0b6c3d59-5506-49cd-84f1-9251f1a72650/report.json).
