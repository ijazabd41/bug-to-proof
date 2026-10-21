# Prospective v5 live reproduction evaluation

Recorded 21 October 2026 for isolated local MiniShop variants. After 16/16 independent browser reference checks and a frozen policy, two development cases ran first, followed by one Groq held-out run with `openai/gpt-oss-20b`, prompt `reproduction-v2`, and compiler 1.4.0. The development cases are excluded from the held-out denominator. The [run policy](../../data/evals/arbitrary-reproduction-v5-run-policy.json) predeclared 14 complete outcomes, at least 10/12 valid candidates, 9/12 executable candidates, and 8/12 independently reviewed report matches.

The dataset hash is `688f1a789ff7b3045c7fdb9b91a1ec8ded85a85098b069afb5b5319464d0a0e9`. The held-out manifest hash is `3f23e63b2d63fed0232220f2dcb266c20858ecb7b38464d85cdf105de4903971`. All 14 raw case outcomes and browser artifacts are retained under `artifacts/arbitrary-reproduction/prospective-evaluation/v5-heldout-groq-2026-10-21/` (Git-ignored). The independently reviewed additive scorecard is `reviewed-scorecard-2026-10-21T04-46-45-863Z.json` in that directory. The frozen source fingerprint matched before and after the run.

| Stage | Observed | Frozen target |
| --- | ---: | ---: |
| Complete retained outcomes | 14/14 | 14/14 |
| Valid candidates, answerable bugs | 11/12 | At least 10/12 |
| Executable candidates, answerable bugs | 11/12 | At least 9/12 |
| Failing assertions, answerable bugs | 11/12 | Diagnostic only |
| Independently reviewed report matches | **10/12** | **At least 8/12** |
| Control false positives | 0/2 | 0 |
| Unclassified infrastructure failures | 0/14 | 0 |
| Classified provider failure | 1/14 | Retained in denominator |
| Human-accepted frozen baselines | 0/12 | Separate gate |
| Verified live-model repairs | 0/12 | Separate gate |

Each of the 11 failing candidates was compared with its frozen report, generated steps and assertion, browser diagnostic, and the unchanged test against fixed MiniShop. Ten failures matched the reported defects and passed on fixed MiniShop. The checkout candidate failed on fixed MiniShop too: it expected a `cart-total` element equal to zero, but correct checkout removes that element. It was reviewed as a mismatch. These are Codex review decisions bound to run IDs and definition hashes, **not human baseline acceptance**.

| Case | Review or outcome | Evidence summary |
| --- | --- | --- |
| `p5-third-keyboard-add-capped` | Match | Third Keyboard add left quantity at 2 instead of 3; unchanged test passed when fixed. |
| `p5-remove-mouse-decrements-keyboard` | Match | Removing Mouse Pad reduced Keyboard quantity from 2 to 1; unchanged test passed when fixed. |
| `p5-sidebar-checkout-keeps-mouse` | Mismatch | Cart-total assertion also failed on fixed source because the element is absent after checkout. |
| `p5-usb-total-under-counts` | Provider blocked | Groq returned HTTP 429 after three recorded request attempts; no candidate was produced. |
| `p5-webcam-catalog-name-camera` | Match | Product name was Camera rather than Webcam; unchanged test passed when fixed. |
| `p5-keyboard-cart-name-mouse` | Match | Keyboard cart line was named Mouse Pad; unchanged test passed when fixed. |
| `p5-promo-keeps-free-shipping-below-threshold` | Match | Shipping stayed zero after the discount lowered the total below the threshold; unchanged test passed when fixed. |
| `p5-promo-success-without-discount` | Match | Successful promo left the total at 10 instead of 8; unchanged test passed when fixed. |
| `p5-blank-promo-shows-error` | Match | Blank promo input displayed an error status; unchanged test passed when fixed. |
| `p5-mouse-adds-two-at-once` | Match | One Mouse Pad add created quantity 2; unchanged test passed when fixed. |
| `p5-single-keyboard-nav-count-zero` | Match | Cart link omitted the count after one Keyboard add; unchanged test passed when fixed. |
| `p5-cart-page-ignores-quantity` | Match | Cart-page total was 10 instead of 20 for two Keyboards; unchanged test passed when fixed. |
| Both controls | No false reproduction | Both generated tests passed against correct behavior. |

The two development cases produced one assertion failure awaiting review and one candidate execution error: the missing promo confirmation caused a visibility wait to fail before the assertion. The development outcomes did not affect the held-out policy or score. The held-out run made 26 provider HTTP request attempts; service-run latency p95 was 27,885 ms across 14 cases and excludes app startup and preflight. Token usage and cost were unavailable for all 14 cases.

The held-out hash is now in the [consumed ledger](../../data/evals/consumed-heldout.json). A deliberate second invocation was rejected before provider contact and created no output directory. This small synthetic MiniShop cohort met its predeclared candidate and reviewed-match targets, but it does not establish broad reliability for arbitrary apps or autonomous repair. A later runner-only fix changed isolated Vite resolution from the root Vite 8 to MiniShop's Vite 5 after a focused failing baseline; the frozen v5 outcome was not rescored. The final full unit suite passed 358/358, and typechecks, builds, standalone browser tests, and demo readiness passed. A human audit of report-to-test mappings, human baseline acceptance, and live-model repair verification remain outstanding. The earlier [v2](prospective-v2-live-evaluation.md) and [v3](prospective-v3-live-evaluation.md) scores remain historical.

## Post-evaluation diagnostic

After the frozen evaluation, the user separately authorized a one-case diagnostic retry of `p5-usb-total-under-counts`, the case originally blocked by HTTP 429. Groq returned a valid candidate on the first request. The candidate clicked the discovery-bound USB Hub control, observed `$14.00` instead of `$15.00` on the isolated defective variant, and the identical compiled test passed against fixed MiniShop. The diagnostic scorecard records 1/1 reviewed report match and zero infrastructure errors. This result is deliberately excluded from the consumed v5 score: the official held-out result remains **10/12**, and the diagnostic did not receive lifecycle human baseline acceptance or live-model repair verification. See the [diagnostic evidence report](p5-usb-retry-diagnostic.md).
