# Post-evaluation USB-total diagnostic retry

Recorded 21 October 2026 after the consumed prospective v5 evaluation. This is a separately authorized diagnostic retry of `p5-usb-total-under-counts`; it is not a rerun or rescore of the frozen v5 held-out cohort.

## Result

| Check | Result |
| --- | --- |
| Provider | Groq OpenAI-compatible endpoint, `openai/gpt-oss-20b` |
| Provider requests | 1 |
| Candidate validity | Valid |
| Browser execution on defective variant | `ASSERTION_FAILED` |
| Expected / actual | `$15.00` / `$14.00` |
| Identical generated test on fixed source | `PASSED` |
| Diagnostic report-match review | `MATCH` |
| Human-accepted frozen baseline | No |
| Effect on frozen v5 score | None; remains 10/12 |

The generated definition cleared local storage, clicked the discovery-bound USB Hub target `add-to-cart-3`, and asserted that `cart-total` equalled 15 USD. The isolated defective source fingerprint was `b95cf89d5653e87e258d098620965c4edb15d82c1e11c9dc66c2d6527802ebed`; the browser observed 14. The same compiled test bytes then passed against fixed source fingerprint `5f05334359364ab89e747dda08ea11c2c1671254a426b86011946a24318cd9c4`.

The reviewed diagnostic scorecard reports 1/1 valid candidate, 1/1 executable candidate, 1/1 assertion failure, and 1/1 reviewed report match, with no infrastructure error. `acceptedFrozenBaselines` remains zero because this review did not invoke the lifecycle acceptance and frozen-baseline gate.

## Integrity

- Diagnostic dataset hash: `3daadc63de5807d4090bb6a59efa7618bbb9e9f87120321c492199f4c317ae7d`
- Definition hash: `03bd18281239aa3d56027d54237aac14b7e55b009373eb5a2dae0cdc0053feaf`
- Compiled test SHA-256: `3218df513d34bd5d8f835e06a04fae8e09199e8c87c7d9226cc37c26a920ae1a`
- Reviewed scorecard: `artifacts/arbitrary-reproduction/prospective-evaluation/diagnostic-p5-usb-retry-2026-10-21/reviewed-scorecard-2026-10-21T16-13-14-689Z.json`
- Fixed-source verification record: `artifacts/arbitrary-reproduction/prospective-evaluation/diagnostic-p5-usb-retry-2026-10-21/fixed-source-verification.json`

The first fixed-source comparison attempted `127.0.0.1` while the Vite process was reachable through `localhost` and ended with `ERR_CONNECTION_REFUSED`. It was treated as an environment attempt, not a product result. The unchanged test was rerun through the reachable endpoint and passed 1/1. Raw browser artifacts remain local and Git-ignored.

## Interpretation

This retry shows that the case originally blocked by HTTP 429 can produce a correct report-matched candidate when the provider responds. It does not erase the original provider failure, change the consumed cohort denominator, establish a human-accepted baseline, or verify a live-model repair.
