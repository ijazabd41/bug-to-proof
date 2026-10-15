# Bug-to-Proof

> Turn a structured bug report into a constrained browser reproduction, a reviewed repair, and evidence that can be independently checked.

Bug-to-Proof is a TypeScript/React portfolio project built around one question: **can an AI-assisted repair workflow prove what happened instead of merely claiming success?**

For the included MiniShop application, the system discovers trusted UI targets, generates a schema-constrained Playwright candidate, pauses for hash-bound human review, records the baseline against unchanged source, verifies an isolated patch with the identical test, runs regression gates, and exports a SHA-256 manifest-backed proof bundle.

This is an evidence-engineering prototype, not an “any website, any bug” product. The verified target is the configured local MiniShop application, and provider or environment failures are never counted as reproduced product bugs.

## Why it is different

- **Constrained generation:** candidates use versioned actions and assertions. Raw CSS, XPath, JavaScript, and arbitrary selectors are rejected.
- **Discovery-bound controls:** repeated controls are addressed through identities issued by the page inventory.
- **Human approval:** the reviewed definition and compiled test are frozen and bound to SHA-256 hashes.
- **Honest lifecycle states:** only a report-relevant assertion failure on unchanged source reaches `REPRODUCED`.
- **Same-test verification:** the exact accepted test must fail before the patch and pass afterward.
- **Isolated repair:** proposed edits are applied in a contained workspace with path and diff validation.
- **Fail-closed gates:** typecheck, build, tests, provenance, and proof checks must all pass.
- **Auditable output:** proof bundles contain a versioned manifest and per-file digests.

## Verified results

The retained AR7 scorecard reports results with their denominators:

| Cohort | Result |
| --- | --- |
| Discovery-bound acceptance | 3/3 executable candidates; 2/3 relevant assertion failures |
| Human-reviewed baselines | 1/2 review-eligible failures accepted and frozen |
| End-to-end reference repair | 1/1 passed identical-test, regression, and proof checks |
| Frozen held-out reports | 2/4 valid candidates; 1/4 executable; 0/4 relevant reproductions |
| Held-out infrastructure failures | 2/4 provider-connectivity failures |

The end-to-end repair proposal was deterministic reference output. Its browser execution, unchanged-test verification, regression gates, and proof validation were real. The frozen held-out set was executed once and was not reused after a discovered locator gap was fixed.

See the [sanitized evaluation summary](docs/evidence/ar7-evaluation.md) and [current project status](docs/current-project-status.md) for the full boundary.

## Architecture

```mermaid
flowchart LR
    R[Structured report] --> D[Bounded page discovery]
    D --> G[Schema-constrained candidate]
    G --> V[Policy and inventory validation]
    V --> E[Playwright evidence runner]
    E --> H{Relevant assertion failure?}
    H -- no --> S[Honest terminal state]
    H -- yes --> A[Hash-bound human review]
    A --> F[Frozen reproduction]
    F --> P[Isolated patch proposal]
    P --> C[Same-test and regression checks]
    C --> B[Manifest-backed proof bundle]
```

The API owns lifecycle persistence, discovery, candidate validation, repair orchestration, and proof export. The dashboard presents reports, review checkpoints, evidence, and final states. MiniShop is the deliberately bounded target application.

## Quick start

Requirements: Node.js 22+, npm 9+, and Chromium for browser verification.

```bash
git clone <your-repository-url>
cd bug-to-proof
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

The development command starts:

- Dashboard: <http://localhost:5173>
- API: <http://localhost:3001>
- MiniShop: <http://localhost:5174>

Provider-backed generation is optional. Configure the documented variables in your local `.env`; never commit that file.

## Run the checks

```bash
npm run typecheck
npm run test:unit -- --maxWorkers=2
npm run build
```

Useful workflows:

```bash
# Rebuild the scorecard when retained local evidence is present
npm run arbitrary:evaluate

# Run the local report-to-proof reference
npm run arbitrary:verify

# Validate the retained demo chain (requires its local runtime evidence)
npm run demo:check

# Inspect disposable artifact cleanup without deleting anything
npm run artifacts:clean
```

The live held-out command sends reports to the configured external provider. Run it only with explicit authorization:

```bash
npm run arbitrary:evaluate:live -- --confirm-live
```

## Demo

Use the [3–4 minute dynamic demo script](docs/dynamic-demo-script.md). It walks through:

1. a structured report without a handwritten test;
2. bounded discovery and constrained generation;
3. exact candidate review and hash binding;
4. a retained assertion failure on unchanged source;
5. identical-test repair verification and proof export;
6. measured results, including failures and limitations.

The local readiness check is deliberately fail-closed. Generated runtime evidence stays under `artifacts/` and is excluded from Git; the public repository retains only sanitized summaries under `docs/evidence/`.

## Repository map

```text
apps/dashboard/       React dashboard and review UI
apps/minishop/        Configured demo target
services/api/         Express API, lifecycle, repair graph, proof export
packages/shared-types Shared contracts
tests/playwright/     Browser reproduction specifications
data/evals/           Frozen benchmark and evaluation datasets
scripts/              Evidence, evaluation, verification, and cleanup tools
docs/                 Current documentation and sanitized evidence
artifacts/            Local generated evidence (Git-ignored)
```

## Security and evidence model

- Report text is treated as untrusted data.
- Generated locators must match the sanitized discovery inventory.
- Provider output is schema-validated before compilation or execution.
- Secrets and raw provider payloads are not part of public evidence.
- Approval is bound to proposal and test hashes.
- Path containment and archive allowlists protect isolated workspaces and exports.
- Infrastructure, timeout, navigation, and selector errors remain distinct from product failures.

For implementation details, historical milestones, and exact limitations, start at the [documentation index](docs/README.md).

## Portfolio material

- [LinkedIn and résumé copy](docs/portfolio-release.md)
- [Dynamic demo script](docs/dynamic-demo-script.md)
- [Sanitized AR7 evaluation](docs/evidence/ar7-evaluation.md)
- [Current verification status](docs/current-project-status.md)

## License

No license has been selected yet. The source is visible for review, but reuse rights are not granted until a license is added.
