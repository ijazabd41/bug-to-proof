# Prospective v3 live reproduction evaluation

Recorded 20 October 2026 for isolated local MiniShop variants. The frozen held-out split was run once through Groq's OpenAI-compatible endpoint with `openai/gpt-oss-20b`, prompt `reproduction-v2`, and compiler 1.4.0. The two development cases ran first and are excluded from the held-out denominator. The run policy was frozen in [`data/evals/arbitrary-reproduction-v3-run-policy.json`](../../data/evals/arbitrary-reproduction-v3-run-policy.json).

The dataset hash is `610d9ed31d4132761d9e2cdc693ecc500d3b5f4e1c0ca9491b4c02f7227d7fec`; the live manifest hash is `2e67da63c29785f5af71399c3a342d55b0add4819c5c33de1aa019b9986cba1a`. All 14 held-out outcomes and browser artifacts are retained under `artifacts/arbitrary-reproduction/prospective-evaluation/v3-heldout-groq-2026-10-20/` (Git-ignored). The primary MiniShop fingerprint matched the frozen value before and after the run.

| Stage | Observed | Frozen target |
| --- | ---: | ---: |
| Complete retained outcomes | 14/14 | 14/14 |
| Valid candidates, answerable bugs | 12/12 | At least 10/12 |
| Executable candidates, answerable bugs | 11/12 | At least 9/12 |
| Failing assertions, answerable bugs | 10/12 | Diagnostic only |
| Independently reviewed report matches | **7/12** | **At least 8/12** |
| Control false positives | 0/2 | 0 |
| Unclassified infrastructure failures | 0/14 | 0 |
| Human-accepted frozen baselines | 0/12 | Not measured here |
| Verified live-model repairs | 0/12 | Not measured here |

The 10 failing candidates were compared with the frozen report, generated steps and assertion, browser diagnostic, and an unchanged test run against fixed MiniShop. Seven matched the reported defect and passed on fixed MiniShop. Three failed on fixed MiniShop too because they asserted on the promo input, Apply button, or an exact whole cart-line string rather than the reported message/name. One candidate passed on the buggy app; one stopped before its assertion because it waited for a cart line on the shop page. Neither was counted as a report match. These are Codex review decisions bound to run IDs and definition hashes, **not human approval**.

| Case | Decision | Evidence summary |
| --- | --- | --- |
| `p3-nav-count-ignores-quantity` | Match | Cart count was 1 after two adds; unchanged test passed when fixed. |
| `p3-remove-keyboard-does-nothing` | Match | Removed line stayed visible; unchanged test passed when fixed. |
| `p3-cart-page-checkout-noop` | Match | Checkout left the cart line visible; unchanged test passed when fixed. |
| `p3-cart-page-total-adds-five` | Match | Total was 15 rather than 10; unchanged test passed when fixed. |
| `p3-webcam-missing-from-catalog` | No failing assertion | Candidate passed against the buggy variant. |
| `p3-lowercase-promo-rejected` | Mismatch | Assertion read promo input text; it failed on fixed MiniShop. |
| `p3-valid-promo-shows-error` | Mismatch | Assertion read Apply button text; it failed on fixed MiniShop. |
| `p3-webcam-adds-keyboard` | Match | Webcam cart line was absent after adding Webcam; unchanged test passed when fixed. |
| `p3-shipping-free-too-early` | Match | Shipping was zero rather than five; unchanged test passed when fixed. |
| `p3-promo-discounts-first-item-only` | Match | Total was 28 rather than 24; unchanged test passed when fixed. |
| `p3-cart-webcam-name-wrong` | Mismatch | Exact whole-line comparison failed even when fixed because quantity and price share the line. |
| `p3-back-link-clears-cart` | No executable assertion | Candidate waited for a cart line on the shop page and stopped early. |
| Both controls | No false reproduction | Both candidates passed on correct behavior. |

The immutable raw `aggregate.json` records 1 infrastructure error under the original coarse scoring rule. Its retained run shows `CANDIDATE_EXECUTION_ERROR` / `INVALID_REPORT` for the misplaced cart-line wait, not an environment or provider outage. The scorer was corrected with a focused regression test that still counts missing Playwright reports as infrastructure errors; the additive `reviewed-scorecard-2026-10-20T18-32-15-180Z.json` reports zero infrastructure failures and leaves the raw outcome untouched. The two development cases were 1/2 executable and 1/2 failing assertions; their generated tests also used wrong targets, and they are excluded from all held-out figures.

The run made 36 provider HTTP request attempts. Service-run latency p95 was 79,544 ms across 14 cases; it excludes app startup and preflight. Token usage and cost were unavailable for all 14 cases. The sample is small and synthetic. The predeclared 8/12 match target was missed, so this does not establish reliability for autonomous reproduction or repair. See [reference verification](prospective-v3-reference.md) for independently checked ground truth and [v2](prospective-v2-live-evaluation.md) for the previous consumed cohort. Both v2 and v3 held-out hashes are in the consumed ledger and must not be rerun after tuning.

After scoring, a candidate-policy change rejected exact text assertions against input/button controls and a composite cart row. A read-only audit over the retained v3 definitions accepted all seven reviewed matches and rejected the three reviewed mismatches. This is post-evaluation development evidence only; it does not alter the 7/12 prospective result.

The local MiniShop was subsequently given distinct discovery targets for promo status, cart item name, product name, and product price. This changes its source fingerprint. The v3 evidence remains bound to the previously frozen source and is not a measured result for the updated target.
