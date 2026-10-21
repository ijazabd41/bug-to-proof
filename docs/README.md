# Bug-to-Proof documentation

This page is the documentation entry point. Documents are grouped by purpose and freshness so historical audit results are not mistaken for current product capability.

Raw runtime evidence is intentionally Git-ignored. Artifact links in historical reports refer to the local evidence-producing checkout and may not resolve in a fresh public clone. Use the [sanitized AR7 evaluation](evidence/ar7-evaluation.md) for the public scorecard.

## Current truth

| Document | Purpose |
| --- | --- |
| [README](../README.md) | Product overview, supported setup, and accurate capability boundary |
| [Current project status](current-project-status.md) | Current architecture, verification matrix, limitations, and release claims |
| [Arbitrary reproduction plan](../plans/arbitrary-bug-reproduction-plan.md) | Implementation design for turning a new report into a validated, frozen reproduction test |
| [Arbitrary reproduction tracker](progress/arbitrary-bug-reproduction.md) | Milestone progress and evidence links for that feature |
| [Reliability hardening plan](../plans/reliability-hardening-plan.md) | Provider recovery, prospective evaluation, and evidence gates |
| [Reliability hardening tracker](progress/reliability-hardening.md) | Current changes, recorded verification, and remaining work |
| [Dynamic repair plan](../plans/dynamic-ai-repair-plan.md) | Implemented existing-test repair architecture and remaining milestones |
| [Dynamic repair progress](../progress.md) | Engineering handoff and recorded implementation progress |
| [UI redesign verification](ui-redesign-verification.md) | Current dashboard changes and browser evidence |

## Guides

| Document | Scope |
| --- | --- |
| [Demo script](demo-script.md) | Configured benchmark demonstration; review prerequisites before recording |
| [Dynamic demo script](dynamic-demo-script.md) | Arbitrary-report generation, review, frozen baseline, and proof walkthrough |
| [Architecture diagrams](architecture.md) | System, lifecycle, and trust-boundary diagrams for documentation and presentations |
| [Portfolio release notes](portfolio-release.md) | Resume bullet, LinkedIn draft, verified metrics, and claim boundary |
| [Sanitized AR7 evaluation](evidence/ar7-evaluation.md) | Public scorecard, provenance hashes, and honest claim boundary |
| [Prospective v2 reference verification](evidence/prospective-v2-reference.md) | Frozen cohort and independent browser ground truth |
| [Prospective v2 live evaluation](evidence/prospective-v2-live-evaluation.md) | One-time Groq held-out run, candidate review, and observed 4/12 report matches |
| [Prospective v3 reference verification](evidence/prospective-v3-reference.md) | Independently checked browser ground truth for the newer frozen cohort |
| [Prospective v3 live evaluation](evidence/prospective-v3-live-evaluation.md) | One-time Groq held-out run, candidate review, and observed 7/12 report matches |
| [Prospective v4 reference verification](evidence/prospective-v4-reference.md) | Browser-verified but withdrawn before model use after overlap with consumed cases was found |
| [Prospective v5 reference verification](evidence/prospective-v5-reference.md) | Replacement frozen cohort, 16/16 local browser checks |
| [Prospective v5 live evaluation](evidence/prospective-v5-live-evaluation.md) | One-time Groq held-out run, 14/14 retained outcomes, 10/12 reviewed report matches |
| [Post-evaluation USB-total diagnostic](evidence/p5-usb-retry-diagnostic.md) | Separate retry of the v5 HTTP-429 case; report-matched failure and unchanged-test fixed-source pass, excluded from v5 scoring |
| [RAG architecture and interview guide](rag-interview-guide.md) | Retrieval providers, evaluation, tradeoffs, and interview explanation |
| [Design concepts](design-concepts/prompts.md) | Dashboard concept prompts; mock data is illustrative |
| [Demo recording](../demo_recording.md) | Historical configured-case demo recording |

## Point-in-time reports

Each report’s date, source identity, commands, and limitations define its scope. A historical pass does not establish the current working tree.

| Document | Classification |
| --- | --- |
| [Comprehensive system audit](system-test-report.md) | 2026-10-09 system verification |
| [RAG upgrade report](rag-upgrade-report.md) | RAG implementation and evaluation report |
| [Portfolio review](portfolio-review.md) | Historical portfolio assessment |
| [Startup fix verification](startup-fix-verification.md) | Historical focused regression report |
| [Final follow-up review](final-followup-review.md) | Historical review later superseded by current status |
| [Latest review](latest-review.md) | Historical snapshot despite its filename |
| [Project recheck](project-recheck.md) | Historical static review |
| [Project review prompt](project-review-prompt.md) | Archived prompt, not operating instructions |

## Archive

| Document | Reason retained |
| --- | --- |
| [Original hackathon plan](../plans/bug-to-proof-plan.md) | Greenfield team plan; implementation has moved beyond it |
| [Legacy local agent workflow](ai-workflow.md) | Earlier case-001 agent, not the dynamic repair engine |
| [Original team progress](progress/PROGRESS.md) | Hackathon team tracker |
| [Abdullah progress](progress/PROGRESS-abdullah.md) | Historical team ownership record |
| [Rida progress](progress/PROGRESS-rida.md) | Historical team ownership record |
| [Sikander progress](progress/PROGRESS-sikander.md) | Historical team ownership record |

## Documentation rules

1. Update `current-project-status.md` when capability or verification claims change.
2. Update `progress/arbitrary-bug-reproduction.md` only with executed results and artifact paths.
3. Label simulations, contract tests, browser runs, live-model runs, and static inspection separately.
4. Never describe a generated test as a reproduction until the unchanged application produces a report-relevant `ASSERTION_FAILED` result.
5. Keep historical documents intact except for status banners and corrected links.
6. Use repository-relative links; avoid machine-specific absolute paths.

