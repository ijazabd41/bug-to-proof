# Prospective v2 live reproduction evaluation

Recorded 20 October 2026. Scope: configured local MiniShop only. The frozen held-out split was run once through the configured Groq OpenAI-compatible endpoint (`openai/gpt-oss-20b`), with compiler 1.2.0 and prompt `reproduction-v1`. Two separate development reports were run first; both generated failing browser assertions, but they are **not** in the held-out denominator.

The 14 held-out cases comprise 12 independently verified synthetic bugs and 2 non-bug controls. Each result was retained under `artifacts/arbitrary-reproduction/prospective-evaluation/v2-heldout-groq-2026-10-20/` (Git-ignored). The dataset hash is `088b6b5bab0fc9b22322d551bfa2736e4015d81db6cf6b942d079b384c1b72d5`; the live manifest hash is `e438134feccc2140030a80adbb67dab251310cf7ce0d0fa0da653218cbbe311b`. The primary MiniShop fingerprint matched the frozen value before and after the run.

| Stage | Observed |
| --- | ---: |
| Complete retained outcomes | 14/14 |
| Valid candidates, answerable bugs | 12/12 |
| Executable candidates, answerable bugs | 12/12 |
| Any failing assertion, answerable bugs | 11/12 |
| Independently reviewed report-matched failing assertions | **4/12** |
| Non-bug controls falsely reproduced | 0/2 |
| Accepted, frozen human-approved baselines | 0/12 |
| Verified live-model repairs | 0/12 |
| Classified provider or infrastructure errors | 0/14 |
| Provider HTTP request attempts | 29 across 14 cases |
| Recorded service-run latency p95 | 79,653 ms across 14 cases |
| Provider usage unavailable | 14/14 cases |

The 11 generated failing assertions were reviewed separately from generation. The reviewer compared each report, generated action and assertion, browser diagnostic, and an unchanged generated test run on the fixed MiniShop. This is **Codex review**, not a human approval in the product. Four assertions matched their reports and passed on fixed MiniShop. Seven failed on both buggy and fixed MiniShop or never reached the reported behavior. The remaining bug case produced no failing assertion. The predeclared target of 8/12 reviewed matches was missed. The result supports the workflow's fail-closed review boundary; it does not support a broad reliability claim for automatic reproduction.

| Case | Review | Main evidence |
| --- | --- | --- |
| `p2-total-extra-fee` | Mismatch | Full-page navigation emptied the in-memory cart; the total was missing on both variants. |
| `p2-second-product-ignored` | Mismatch | The selected text target was missing on both variants. |
| `p2-remove-mouse-removes-keyboard` | Match | Keyboard disappeared after removing Mouse Pad; identical test passed on fixed MiniShop. |
| `p2-checkout-keeps-cart` | Mismatch | Checkout locator timed out; identical test had an action error on fixed MiniShop. |
| `p2-cart-link-opens-shop` | Match | Cart link stayed at `/`; identical test reached `/cart` on fixed MiniShop. |
| `p2-back-link-stays-cart` | Match | Back link stayed at `/cart`; identical test reached `/` on fixed MiniShop. |
| `p2-quantity-label-off-by-one` | Match | One Keyboard displayed quantity 2; identical test passed on fixed MiniShop. |
| `p2-line-price-ignores-quantity` | Mismatch | Full-page navigation emptied the cart; price target missing on both variants. |
| `p2-invalid-promo-accepted` | Mismatch | Assertion read the promo textbox instead of the validation message. |
| `p2-promo-clears-items` | No assertion | Generated flow timed out, then a later candidate passed on the buggy variant. |
| `p2-shipping-fee-six` | Mismatch | Shipping target was missing on both variants. |
| `p2-promo-discount-ten` | Mismatch | Assertion observed $10, not reported $9, and failed on fixed MiniShop too. |
| Both controls | No false reproduction | Both final candidates passed on the correct app behavior. |

The raw `aggregate.json` is the pre-review record; `reviewed-scorecard-2026-10-20T17-50-15-023Z.json` recalculates all 11 decisions and adds request/latency totals without overwriting that record or the first reviewed scorecard. Each `review.json` is bound to the candidate definition hash and run ID. The `fixed-source-check/result.json` and browser evidence support each comparison. The latency is measured from each reproduction service run's creation to completion, excluding isolated app startup and preflight. Provider token usage and cost are unknown. The sample is small and synthetic. Reference browser checks establish the ground truth separately in [prospective v2 reference verification](prospective-v2-reference.md).

Next improvements should use new development cases: preserve client-side cart state by using the discovered navigation control, reject assertions against absent or semantically wrong targets, and add bounded waits after async actions. Any later model evaluation needs a newly frozen held-out cohort; this consumed split must not be rescored after tuning.
