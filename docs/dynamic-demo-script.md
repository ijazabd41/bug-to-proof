# Dynamic arbitrary-report demo (3–4 minutes)

This demo is scoped to the configured local MiniShop. It shows the actual generated-test lifecycle; it does not claim support for arbitrary external websites.

## Before recording

1. Run `npm run typecheck`, `npm run build`, `npm run arbitrary:evaluate`, and `npm run demo:check`.
2. Start Dashboard, API, and MiniShop with `npm run dev`.
3. Open the dashboard at `http://localhost:5173` and MiniShop at `http://localhost:5174`.
4. Keep the accepted calculation case `case-1791917776888-hvza72c3` available as the reliable recorded path.

The frozen held-out runner is `npm run arbitrary:evaluate:live -- --confirm-live`. Run it only after the operator explicitly authorizes sending the four frozen reports to the configured external provider.

`npm run demo:check` fails closed unless the structured case, reviewed run, accepted bytes, baseline failure, identical-test repair result, regression gates, independently extractable proof bundle, scorecard, and presentation documents agree. Its machine-readable result is `artifacts/arbitrary-reproduction/ar7-evaluation/demo-readiness.json`.

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

### 6. Close with measured results (30 seconds)

Open `artifacts/arbitrary-reproduction/ar7-evaluation/evaluation-report.md`. Use the displayed denominators: 3/3 discovery-bound acceptance reports produced executable candidates, 2/3 produced relevant assertion failures, and 1/2 review-eligible failures completed human acceptance. Then show the separately frozen held-out result: 2/4 valid candidates, 1/4 executable passing baseline, 0/4 relevant reproductions, and 2/4 provider-connectivity failures. Explain that the held-out run exposed the textbox locator gap fixed by compiler 1.1.0 and was not rerun after that correction.

## Recording safety

- Do not expose `.env`, provider keys, raw provider payloads, or local user paths.
- Do not trigger a live source-bearing model repair unless the operator has explicitly authorized transmission to the configured provider.
- If a provider or environment step fails, show its honest lifecycle classification rather than editing the evidence.
