# Bug-to-Proof portfolio release notes

## Resume bullet

Built an evidence-backed TypeScript/React bug-reproduction pipeline that turns structured MiniShop reports into schema-constrained Playwright tests, binds human approval with SHA-256 hashes, verifies the identical test before and after isolated patches, runs regression gates, and exports independently verified proof bundles.

## LinkedIn draft

I built Bug-to-Proof to explore a harder question than “can an AI write a patch?”: can it produce evidence you can audit?

For a configured local React application, the workflow now starts from a structured bug report, discovers trusted UI targets, generates a constrained Playwright candidate, pauses for hash-bound human review, freezes the accepted test, and requires a real assertion failure on unchanged source. A repair is only verified when the identical test passes afterward, required regressions pass, and a manifest-backed proof bundle independently checks out.

The numbers are deliberately reported with denominators: in the final discovery-bound acceptance cohort, 3/3 reports produced executable candidates, 2/3 produced relevant assertion failures, and 1/2 review-eligible failures completed human acceptance and frozen-baseline confirmation. On the separately frozen held-out cohort, 2/4 reports produced valid candidates, 1/4 reached an executable passing baseline, 0/4 produced a relevant reproduction, and 2/4 hit provider connectivity failures. The end-to-end reference repair passed the same-test and regression gates, while the repair proposal itself was deterministic rather than a live source-bearing model call.

What I learned: reliable AI engineering is mostly boundary design—typed contracts, constrained execution, human approval, immutable identities, honest failure classification, and evidence that survives outside the demo.

Stack: TypeScript, React, Express, Playwright, Vitest, LangGraph-style state orchestration, and SHA-256/ZIP proof manifests.

## Honest claim boundary

The verified target is the repository’s local MiniShop, not arbitrary websites. Live reproduction generation and one frozen held-out run are recorded. The held-out cohort is now consumed and was not rerun after its textbox-locator failure motivated compiler 1.1.0. A live-model arbitrary-source repair still requires explicit authorization for external source transmission.
