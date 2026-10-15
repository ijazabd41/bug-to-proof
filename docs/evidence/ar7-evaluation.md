# AR7 evaluation summary

Generated from retained evidence on 2026-10-14. This sanitized summary applies only to the configured local MiniShop application.

| Measure | Result |
| --- | --- |
| Initial usable provider responses | 3/8 (37.5%) |
| Initial valid candidates | 4/9 (44.4%) |
| Initial executable candidates | 4/9 (44.4%) |
| Discovery-bound executable candidates | 3/3 (100%) |
| Discovery-bound relevant reproductions | 2/3 (66.7%) |
| Human-accepted reproduced baselines | 1/2 (50%) |
| End-to-end verified reference repairs | 1/1 (100%) |
| Frozen held-out valid candidates | 2/4 (50%) |
| Frozen held-out executable candidates | 1/4 (25%) |
| Frozen held-out relevant reproductions | 0/4 (0%) |
| Frozen held-out infrastructure errors | 2/4 (50%) |

## Provenance

- Frozen arbitrary-report dataset hash: `d180534a4320c993283ffa07e4350ef20431eda137c1361f50ea4316591feba3`
- Reviewed reproduction run: `8dca2a60-8416-40e4-a4e6-e7de42948cf4`
- Reference repair run: `run-43ebe23d-fcf4-4f26-9494-4a2cb913427b`
- Accepted compiled-test hash: `4c571551e174c161da1f2093ac138eda138b4f4e512bd3ff54b7d23d378431f9`
- Test fingerprint: `48f3565ee820b974f24a16c4d15a3550ef2d613e3d152df5832c93370194fd10`
- Configured MiniShop source fingerprint: `7806a8885a9410200ff4f2f51c9a208f4c2cf7ab2ba2508a0d8d192cb4f32289`

## Claim boundary

Live candidate generation and the reviewed frozen baseline were real. The end-to-end repair proposal was deterministic reference output; its isolated application, browser verification, regression gates, and proof-manifest validation were real. No live-model arbitrary-source repair was performed because source transmission was not authorized.

The prospective four-report held-out cohort was executed once without post-freeze prompt tuning. It produced no relevant reproduction: one report reached a passing baseline, one exhausted retries after action/empty-response failures, and two were blocked by provider connectivity. That run exposed a trusted textbox-locator mismatch. Compiler 1.1.0 added the inventory-bound `fillTarget` action and verified it through a real browser fixture, but the consumed held-out split was not rerun.

Raw run evidence and proof ZIPs are local runtime output and are intentionally excluded from the public repository.
