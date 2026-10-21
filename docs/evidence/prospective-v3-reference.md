# Prospective v3 reference verification

Recorded 20 October 2026 for the configured local MiniShop. This verifies the frozen fixtures with independent browser tests; it is not a model score.

| Cohort | Buggy variant | Fixed variant |
| --- | ---: | ---: |
| 2 development bugs | 2/2 assertion failures | 2/2 passes |
| 12 held-out bugs | 12/12 assertion failures | 12/12 passes |
| 2 held-out controls | 2/2 passes | No patch |

All 16 isolated cases were `VERIFIED` in the final reference run. A nonunique fixture replacement in the valid-promo case was corrected before the dataset was frozen; its focused check and then the complete reference suite passed. The reference tests, defect snippets, and fixes remained local and were not included in the generation prompt.

- Frozen dataset: [`data/evals/arbitrary-reproduction-v3.json`](../../data/evals/arbitrary-reproduction-v3.json)
- Dataset hash: `610d9ed31d4132761d9e2cdc693ecc500d3b5f4e1c0ca9491b4c02f7227d7fec`
- Frozen at: `2026-10-20T18:09:01.836Z`
- Primary MiniShop fingerprint: `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`
- Local raw evidence: `artifacts/arbitrary-reproduction/prospective-reference/2026-10-20T18-05-16-325Z/` and `v3-freeze-final.log` in that parent directory. Runtime artifacts are Git-ignored.

The subsequent live result is in [the v3 evaluation](prospective-v3-live-evaluation.md). A separate human audit of report-to-reference-test mapping has not occurred.
