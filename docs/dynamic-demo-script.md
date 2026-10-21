# Dynamic arbitrary-report demo (4–5 minutes)

This demo is scoped to the configured local MiniShop. It shows the actual generated-test lifecycle; it does not claim support for arbitrary external websites.

## Before recording

1. Run `npm run typecheck`, `npm run build`, `npm run test:unit -- --maxWorkers=1 --no-file-parallelism`, `npm run test:playwright`, and `npm run demo:check`.
2. Start Dashboard, API, and MiniShop with `npm run dev`.
3. Open the dashboard at `http://localhost:5173` and MiniShop at `http://localhost:5174`.
4. Keep the accepted calculation case `case-1791917776888-hvza72c3` available as the reliable recorded path.
5. Open the [v5 live evaluation](evidence/prospective-v5-live-evaluation.md) and the retained local `artifacts/arbitrary-reproduction/prospective-evaluation/v5-heldout-groq-2026-10-21/` directory for the measured failure path and scorecard.

The v5 held-out dataset has been consumed. Show its retained artifacts; do not run it again for a new score.

`npm run demo:check` fails closed unless the structured case, reviewed run, accepted bytes, baseline failure, identical-test repair result, regression gates, independently extractable proof bundle, scorecard, and presentation documents agree. Its machine-readable result is generated locally under `artifacts/arbitrary-reproduction/ar7-evaluation/` and is intentionally excluded from Git.

## Storyboard

### 1. Start from a report (30 seconds)

Show the structured report: the cart contains a $10 keyboard and displays $5 shipping, but Total incorrectly remains $10 instead of $15. Point out that the report starts without a hand-written Playwright test.

### 2. Show bounded discovery and generation (40 seconds)

Open the reproduction lifecycle. Explain that the system inventories trusted routes and `data-testid` controls, then asks the provider for versioned actions and assertions. Emphasize that raw JavaScript, CSS, and XPath are outside the contract.

### 3. Review the exact candidate (40 seconds)

Show the generated action (`add-to-cart-1`) and assertion (`cart-total` equals 15). Show the definition and compiled-test hashes. Explain that approval freezes those exact bytes; editing or swapping the test requires a fresh review.

### 4. Show the unchanged-source failure (35 seconds)

Show state `REPRODUCED`, outcome `ASSERTION_FAILED`, expected 15, received 10, and the retained screenshot/trace. Mention that selector errors and provider failures do not qualify as bugs.

### 5. Show repair verification and proof (45 seconds)

Open the AR6 reference result and Proof Bundle. Show baseline failure, post-patch pass, identical test fingerprint, passing typecheck/build/unit checks, and verified manifest provenance. State clearly that this recorded proposal is deterministic reference output; the execution and evidence gates are real.

### 6. Show an honest failure path (30 seconds)

Open the retained `p5-usb-total-under-counts/run.json` under the v5 held-out directory. Show `BLOCKED`, Groq HTTP 429, and the three recorded HTTP requests. Point to the per-case record as evidence. Explain the safe retry choice: once provider quota recovers, start a new ordinary case run; keep the v5 held-out score unchanged because that split is consumed. The 429 is an infrastructure outcome, not a reproduced MiniShop bug.

### 7. Close with measured results (30 seconds)

Open the [v5 public scorecard](evidence/prospective-v5-live-evaluation.md). State the denominator: 14/14 retained outcomes, 11/12 valid executable bug candidates, 10/12 independently reviewed report matches, one classified provider 429, and 0/2 control false positives. The predeclared 8/12 match target was met on this small MiniShop cohort. State that the reviewed matches have not received human baseline acceptance or live-model repair verification. The older AR7, v2, and v3 results remain historical.

## Recording safety

- Do not expose `.env`, provider keys, raw provider payloads, or local user paths.
- Do not trigger a live source-bearing model repair unless the operator has explicitly authorized transmission to the configured provider.
- If a provider or environment step fails, show its honest lifecycle classification rather than editing the evidence.
