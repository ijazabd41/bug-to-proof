# Prospective v5 reference verification

Recorded 21 October 2026 for the configured local MiniShop. This is independent ground-truth verification, not a model-generation score.

| Cohort | Defective variant | Fixed variant |
| --- | ---: | ---: |
| 2 development bugs | 2/2 assertion failures | 2/2 passes |
| 12 held-out bugs | 12/12 assertion failures | 12/12 passes |
| 2 held-out controls | 2/2 passes | No patch |

The v4 cohort was withdrawn before provider use after repeated scenarios were found against consumed v2/v3 reports. Three replacement v5 cases passed focused browser checks. The complete v5 16-case browser pass then returned 16/16 `VERIFIED`, with same-test failure before and pass after each synthetic bug fix. V5 was frozen only after that full pass. Generation receives each report and a bounded MiniShop target inventory; it does not receive the reference test, defect snippet, fix, or label.

- Frozen dataset: [`data/evals/arbitrary-reproduction-v5.json`](../../data/evals/arbitrary-reproduction-v5.json)
- Dataset hash: `688f1a789ff7b3045c7fdb9b91a1ec8ded85a85098b069afb5b5319464d0a0e9`
- Frozen at: `2026-10-20T19:12:49.651Z` (21 October in Pakistan)
- Primary MiniShop fingerprint: `5f05334359364ab89e747dda08ea11c2c1671254a426b86011946a24318cd9c4`
- Frozen generation policy: [`data/evals/arbitrary-reproduction-v5-run-policy.json`](../../data/evals/arbitrary-reproduction-v5-run-policy.json)
- Local raw evidence: `artifacts/arbitrary-reproduction/prospective-reference/2026-10-20T19-08-59-249Z/` and `v5-freeze-pass-2026-10-21.log` in its parent directory. Runtime artifacts are Git-ignored.

The user authorized v5 external transmission on 21 October 2026. After an earlier automatic approval review usage limit reset, the frozen cohort ran once through Groq. See the separate [live evaluation](prospective-v5-live-evaluation.md); this reference report records ground truth, not generation performance. A human audit of the report-to-reference-test mappings has not occurred.
