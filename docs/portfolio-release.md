# Bug-to-Proof portfolio release notes

## Resume bullet

Built an evidence-backed TypeScript/React bug-reproduction pipeline that turns structured MiniShop reports into schema-constrained Playwright tests, binds human approval with SHA-256 hashes, verifies the identical test before and after isolated patches, runs regression gates, and exports independently verified proof bundles.

## LinkedIn draft

I built Bug-to-Proof to explore a harder question than “can an AI write a patch?”: can it produce evidence you can audit?

For a configured local React application, the workflow now starts from a structured bug report, discovers trusted UI targets, generates a constrained Playwright candidate, pauses for hash-bound human review, freezes the accepted test, and requires a real assertion failure on unchanged source. A repair is only verified when the identical test passes afterward, required regressions pass, and a manifest-backed proof bundle independently checks out.

The numbers are deliberately reported with denominators: in the latest 12-bug/2-control frozen held-out MiniShop evaluation, 11/12 bugs produced valid executable candidates and failing assertions, and 10/12 passed independent report-match review. Neither control was falsely reproduced. The predeclared target was 8/12 reviewed matches, which this small MiniShop cohort exceeded. One bug case was blocked by a classified Groq HTTP 429. No v5 candidate has human baseline acceptance or live-model repair verification. The earlier end-to-end reference repair passed the same-test and regression gates, while its repair proposal was deterministic rather than a live source-bearing model call.

What I learned: reliable AI engineering is mostly boundary design—typed contracts, constrained execution, human approval, immutable identities, honest failure classification, and evidence that survives outside the demo.

Stack: TypeScript, React, Express, Playwright, Vitest, LangGraph-style state orchestration, and SHA-256/ZIP proof manifests.

## Honest claim boundary

The verified target is the repository’s local MiniShop, not arbitrary websites. Live reproduction generation and separate frozen v2, v3, and v5 held-out runs are recorded. All three cohorts are consumed; none was rerun after observing its outcomes. The browser-verified v4 cohort was withdrawn before model use because it repeated consumed scenarios. The earlier AR7 cohort is also historical. A live-model arbitrary-source repair still requires explicit authorization for external source transmission.

Reliability hardening added provider retries, preflight diagnostics, and a stricter prospective scoring harness. The latest frozen 12-bug/2-control held-out MiniShop cohort passed 16/16 browser reference checks and ran once through the configured Groq endpoint. **10/12** bug reports had independently reviewed report-matched failing assertions, compared with 7/12 in v3 and 4/12 in v2; neither v5 control was falsely reproduced. The predeclared 8/12 match target was met, with one classified provider 429 retained in the denominator. No new candidate received human baseline acceptance or live-model repair verification. The final full unit suite passed 358/358. See the [v5 scorecard](evidence/prospective-v5-live-evaluation.md), [v3 scorecard](evidence/prospective-v3-live-evaluation.md), and [v2 scorecard](evidence/prospective-v2-live-evaluation.md). AR7 remains historical.

A later, separately authorized diagnostic retry of the provider-blocked USB-total report generated a valid candidate on its first request. The candidate failed with expected 15 and actual 14 on the isolated defective variant, then passed unchanged on fixed MiniShop. It is documented as additional reliability evidence, not as a rescore: the frozen v5 result remains 10/12 and lifecycle human baseline acceptance remains pending. See the [USB-total diagnostic report](evidence/p5-usb-retry-diagnostic.md).
