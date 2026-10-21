# Prospective v2 reference verification

Recorded 20 October 2026 for the configured local MiniShop. This is **reference fixture verification**, not a live model reproduction score.

| Cohort | Real browser baseline | Same reference test after fix |
| --- | --- | --- |
| 2 development bug cases | 2/2 `ASSERTION_FAILED` | 2/2 `PASSED` |
| 12 new held-out bug cases | 12/12 `ASSERTION_FAILED` | 12/12 `PASSED` |
| 2 held-out non-bug controls | 2/2 `PASSED` | No patch |

All 16 cases were verified in isolated MiniShop workspaces. The primary MiniShop source fingerprint stayed unchanged. This confirms that each answerable report describes a present synthetic defect and its reference test distinguishes the defective and fixed variants. It does not show that the generation provider can produce those tests.

- Frozen dataset: [`data/evals/arbitrary-reproduction-v2.json`](../../data/evals/arbitrary-reproduction-v2.json)
- Dataset SHA-256: `088b6b5bab0fc9b22322d551bfa2736e4015d81db6cf6b942d079b384c1b72d5`
- Frozen at: `2026-10-20T13:21:07.139Z`
- Primary source fingerprint: `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`
- Reference test fingerprint: `b51faa5fcf1d6389db5a7ab1f98e6f47da050d40c3870653445a5ed71045c7b1`
- Local raw evidence: `artifacts/arbitrary-reproduction/prospective-reference/2026-10-20T13-17-41-123Z/aggregate.json` with per-case browser result directories. These runtime artifacts are Git-ignored.

The held-out reports and rubric were frozen before the live generation run. The generation prompt received only each report and a discovery inventory; it did not receive the reference test, defect snippets, or ground-truth labels. The subsequent one-time held-out run and independent candidate review are recorded in the [live evaluation report](prospective-v2-live-evaluation.md). A separate human audit of the reference report-to-test mappings would strengthen the ground truth further.
