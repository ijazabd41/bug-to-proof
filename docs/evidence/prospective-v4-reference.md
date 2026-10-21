# Prospective v4 reference verification

Recorded 21 October 2026 for the configured local MiniShop. This is independent fixture ground truth, not a live model score. **This cohort was withdrawn before model generation** after a comparison with consumed v2/v3 reports found repeated bug scenarios. Its dataset hash and reference evidence are retained for audit, but it must not be described as an unseen prospective result.

| Cohort | Defective variant | Fixed variant |
| --- | ---: | ---: |
| 2 development bugs | 2/2 assertion failures | 2/2 passes |
| 12 held-out bugs | 12/12 assertion failures | 12/12 passes |
| 2 held-out controls | 2/2 passes | No patch |

The first full pass verified 15/16 cases. The invalid-promo fixture could not be restored because its replacement text was not unique. The snippet was made exact before freeze. A focused browser check passed, followed by a complete 16/16 `VERIFIED` browser pass. No model generation used these reports before freezing. Reference tests, defect snippets, fixes, and labels are withheld from the generation prompt.

- Frozen dataset: [`data/evals/arbitrary-reproduction-v4.json`](../../data/evals/arbitrary-reproduction-v4.json)
- Dataset hash: `64edf731be5c1b5dd976ce4f3ba1fae8bfd5503e8c37e040c5d74b8b7f63af93`
- Frozen at: `2026-10-20T19:04:35Z` (21 October in Pakistan)
- Primary MiniShop fingerprint: `5f05334359364ab89e747dda08ea11c2c1671254a426b86011946a24318cd9c4`
- Frozen generation policy: [`data/evals/arbitrary-reproduction-v4-run-policy.json`](../../data/evals/arbitrary-reproduction-v4-run-policy.json)
- Local raw evidence: `artifacts/arbitrary-reproduction/prospective-reference/2026-10-20T19-00-25-198Z/` and `v4-freeze-pass-2026-10-21.log` in its parent directory. Runtime artifacts are Git-ignored.

The held-out split was not sent to a model. The user authorized a v4 Groq run, but the duplicate-case finding occurred before any provider call, so that run was not performed. A replacement cohort is being verified separately. A human audit of the report-to-reference-test mapping has not occurred.
