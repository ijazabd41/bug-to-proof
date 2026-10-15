# AR7 evaluation scorecard

Generated: 2026-10-14T20:02:25.511Z

| Measure | Result |
| --- | --- |
| Initial usable provider responses | 3/8 (37.5%) |
| Initial valid candidates | 4/9 (44.4%) |
| Initial executable candidates | 4/9 (44.4%) |
| Trusted-target executable candidates | 3/3 (100%) |
| Trusted-target relevant reproductions | 2/3 (66.7%) |
| Human-accepted reproduced baselines | 1/2 (50%) |
| End-to-end verified reference repairs | 1/1 (100%) |
| Frozen held-out valid candidates | 2/4 (50%) |
| Frozen held-out executable candidates | 1/4 (25%) |
| Frozen held-out relevant reproductions | 0/4 (0%) |
| Frozen held-out infrastructure errors | 2/4 (50%) |

## Claim boundary

This evidence applies only to the configured local MiniShop. Live generation and the reviewed frozen baseline are real. The repair proposal used for the end-to-end reference was deterministic; its browser verification, regression gates, and proof-bundle checks were real. The prospective held-out arbitrary-report set was executed once without post-freeze prompt tuning.

## Retained failures

- The initial live cohort produced no relevant assertion failure despite four executable candidates.
- Provider response failures and invalid candidates remain in the denominator.
- Only one of two review-eligible assertion failures received human acceptance and frozen-baseline confirmation.
- The frozen held-out cohort produced no relevant reproduction: one report correctly passed on the current source, one exhausted retries on selector/action and empty-response failures, and two were blocked by provider connectivity.
- No live-model arbitrary-source repair was executed because external source transmission was not authorized.
