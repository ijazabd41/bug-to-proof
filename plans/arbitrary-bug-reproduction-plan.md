# Arbitrary new bug reproduction implementation plan

Status: **AR0–AR7 COMPLETE**
Created: 2026-10-12 (Asia/Karachi)  
Progress: [docs/progress/arbitrary-bug-reproduction.md](../docs/progress/arbitrary-bug-reproduction.md)  
Parent architecture: [dynamic-ai-repair-plan.md](dynamic-ai-repair-plan.md)

## Objective and bounded scope

Turn a newly submitted MiniShop bug report into a reviewable, executable, evidence-backed reproduction without requiring a developer to pre-create a Playwright spec.

The first release is deliberately bounded:

- Target: the configured local MiniShop React application.
- Input: title, description, steps, expected behavior, actual behavior, and optional starting path.
- Output: a validated declarative reproduction definition, a trusted compiled Playwright spec, and a recorded baseline outcome.
- Reproduced means the unchanged target produced a report-relevant `ASSERTION_FAILED` result with structured expected and received values.
- Ambiguous reports, unsupported actions, invalid candidates, missing elements, passing baselines, timeouts, and application/infrastructure errors stop with an explicit non-reproduced outcome.

This does not claim arbitrary repository or arbitrary website support. Generalization follows only after measured MiniShop results.

## Product workflow

1. User submits a report.
2. System validates report completeness and creates a `REPORTED` case.
3. System snapshots the unchanged target and inventories routes and accessible UI.
4. A model proposes a structured reproduction definition using supported actions and assertions.
5. Trusted server code validates and compiles the definition into Playwright.
6. The candidate runs in an isolated pre-baseline workspace.
7. Execution feedback may produce a bounded candidate revision.
8. A human reviews report-to-test correspondence.
9. The accepted definition, compiled test, target, and dependencies are frozen and hashed.
10. The accepted test runs again against unchanged source.
11. Only a relevant assertion failure changes the case to `REPRODUCED`.
12. The existing repair graph uses that exact frozen test for patch verification.

## Honest states

| State | Meaning | Repair allowed? |
| --- | --- | --- |
| `NEEDS_REPORT_DETAILS` | Required behavior or interaction is ambiguous | No |
| `DISCOVERING_TARGET` | Building a bounded UI/source inventory | No |
| `GENERATING_CANDIDATE` | Model is proposing structured test data | No |
| `CANDIDATE_INVALID` | Definition or compiled test violates policy | No |
| `CANDIDATE_EXECUTION_ERROR` | Selector, setup, navigation, or runtime failure | No |
| `BASELINE_PASSED` | Candidate did not demonstrate the reported bug | No |
| `AWAITING_TEST_REVIEW` | Executable candidate needs correspondence review | No |
| `CONFIRMING_BASELINE` | Accepted candidate is rerunning against frozen inputs | No |
| `REPRODUCED` | Accepted frozen test produced the relevant assertion failure | Yes |
| `UNSUPPORTED` | Required behavior is outside the supported definition language | No |
| `CANCELLED` / `BLOCKED` | User cancellation or unrecoverable external condition | No |

No generic failure is a reproduced bug.

## Declarative reproduction language

The model initially generates data, not TypeScript. Trusted code compiles the data.

```ts
interface ReproductionDefinitionV1 {
  schemaVersion: "1.0";
  title: string;
  startPath: string;
  preconditions: ReproductionPrecondition[];
  steps: ReproductionAction[];
  assertion: ReproductionAssertion;
  rationale: string;
  reportMapping: Array<{
    reportFact: string;
    definitionPath: string;
  }>;
}
```

Initial action allowlist:

- `goto` with an application-relative path.
- `click` by accessible role and exact accessible name.
- `fill` by label and bounded text.
- `selectOption` by label and allowed value.
- `waitForVisible` by accessible role/name.
- `reload`.
- Trusted domain setup such as clearing local storage or seeding a cart through controlled helpers.

Initial assertion allowlist:

- Exact visible text.
- Numeric or currency equality after trusted normalization.
- Element count equality.
- URL path equality.
- Visibility or absence.
- Accessible attribute equality.

Excluded from the first release:

- Arbitrary JavaScript, raw TypeScript, model-selected imports, hooks, or fixtures.
- CSS/XPath supplied by the model.
- Shell commands, dependency installation, filesystem access, or external network calls.
- Cross-origin navigation, file upload, download execution, clipboard, permissions, and dialogs.

## Discovery snapshot

Before generation, trusted code records:

- Application routes from source and runtime navigation.
- Accessible roles, names, labels, headings, buttons, links, and form controls.
- Bounded DOM excerpts without hidden inputs, scripts, or secrets.
- MiniShop product fixtures and visible names/prices.
- Relevant source excerpts from the isolated snapshot.
- Source fingerprint, target URL, route list, inventory digest, and capture time.

Definitions may reference only inventoried controls or explicitly request a supported runtime discovery action.

## Deterministic compiler

The compiler must:

- Parse a versioned runtime schema.
- Emit only under a run-specific generated-test directory.
- Import only trusted Playwright and assertion helpers.
- Treat every model string as escaped data.
- Emit structured `BTP_ASSERTION` expected/received attachments.
- Derive stable test identity from definition ID and version.
- Reject unknown keys, actions, assertions, paths, oversized strings, or excessive steps.
- Produce identical bytes for identical canonical input and compiler version.

## Reproduction graph

```text
validateReport
  -> snapshotTarget
  -> discoverSurface
  -> proposeDefinition
  -> validateDefinition
  -> compileCandidate
  -> executeCandidate
  -> classifyCandidate
  -> reviseCandidate (bounded loop)
  -> pauseForTestReview
  -> freezeAcceptedTest
  -> confirmBaseline
  -> finalizeReproduction
```

The repair graph starts only after `finalizeReproduction` records `REPRODUCED` and supplies the accepted fingerprint. Test revision is prohibited after repair investigation begins.

## Run record

Add a separate durable record rather than using `BugCase.reproduction.lastRun` for generation attempts.

```ts
interface ReproductionRunRecord {
  schemaVersion: "1.0";
  reproductionRunId: string;
  caseId: string;
  state: ReproductionRunState;
  reportSnapshot: ReportSnapshot;
  targetSnapshot: TargetSnapshotIdentity;
  discovery?: DiscoverySnapshot;
  attempts: ReproductionAttempt[];
  acceptedCandidate?: AcceptedReproductionCandidate;
  baselineRun?: TestRun;
  events: ReproductionEvent[];
  limits: ReproductionLimits;
  stopReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

Each attempt records the definition, canonical hash, compiler version, compiled hash, provider/model/prompt version, validation findings, execution classification, bounded diagnostics, duration, usage when available, and artifact references.

Acceptance binds the report, target, discovery, policy, compiler, definition, compiled test, and dependency hashes.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cases/:caseId/reproduction-runs` | Start asynchronous generation |
| `GET /api/cases/:caseId/reproduction-runs` | List saved runs newest first |
| `GET /api/reproduction-runs/:runId` | Read state, candidate, diagnostics, and evidence |
| `POST /api/reproduction-runs/:runId/review` | Approve/reject exact definition and test hashes |
| `POST /api/reproduction-runs/:runId/cancel` | Cancel processes and retain evidence |
| `POST /api/reproduction-runs/:runId/clarify` | Add answers and create a report/candidate revision |

Creation returns `202`. Review is idempotent and hash-bound. Clarification creates a revision and invalidates prior acceptance. Existing `/api/cases/:id/reproduce` remains for configured tests; the dashboard selects generation when `testFile` is empty.

## Dashboard

- Show **Generate reproduction** for testless cases instead of an action guaranteed to return an error.
- Display report completeness and missing information.
- Show discovery, generation, validation, execution, review, and baseline as distinct stages.
- Present readable actions and the assertion before compiled code.
- Show inventory references supporting each action.
- Require **Accept this reproduction** or **Reject and revise**.
- Distinguish setup/selector errors, passing baselines, assertion failures, and infrastructure failures.
- Enable **Start repair** only after baseline confirmation.
- Include the definition, compiled spec, review, baseline evidence, hashes, and events in the proof bundle.

## Model strategy and retry policy

Generation context contains only the immutable report, supported schema/examples, bounded discovery inventory, relevant source excerpts, and sanitized prior diagnostics. Output is strict JSON with report-to-definition mapping and explicit assumptions.

- Default maximum: three attempts.
- Retry only actionable validation or candidate execution failures.
- Do not retry target outages as model failures.
- Changed actions or assertion require fresh review and baseline.
- Stop on budget, deadline, cancellation, ambiguity, or repeated unsupported behavior.
- Record missing token or cost data as unknown.

## Isolation and security

- Use the existing run-specific workspace, process registry, timeout, cancellation, port, artifact containment, and cleanup controls.
- Never write a generated test to permanent benchmark specs before acceptance.
- Do not expose secrets, `.git`, artifacts, reference patches, evaluation labels, or held-out tests.
- Treat report and page text as untrusted data.
- Reject absolute/external URLs and cap routes, actions, text, runtime, retries, context, and artifacts.
- Freeze source and test fingerprints before and after every run.
- Store raw model output for audit but never execute it.
- Fail closed when reporter JSON, assertion attachments, evidence, or hashes are missing.
- Preserve rejected and failed attempts; never replace them with a later success.

## Milestones

### AR0 — Documentation, contracts, and baseline

- Correct product claims and establish the documentation hierarchy.
- Define states, transitions, limits, record schemas, and API contracts.
- Add focused tests showing a new case cannot currently reproduce without a test.
- Record current typecheck, unit, build, and browser baseline.

Acceptance: the baseline fails for the missing-test workflow, not the environment. No feature behavior changes.

### AR1 — Report structure and completeness

- Store steps, expected, actual, starting path, and context as first-class fields.
- Add backward-compatible migration for existing JSON.
- Add a completeness validator and dashboard clarification flow.

Acceptance: complete reports can generate; incomplete reports receive precise requests and cannot be labeled reproduced.

### AR2 — Target discovery

- Add isolated route/accessibility discovery with sanitization and bounds.
- Add MiniShop fixture/source inventory and persistent snapshot hashing.

Acceptance: supported MiniShop controls are inventoried; cross-origin and oversized content are refused.

### AR3 — Schema and compiler

- Implement versioned contracts, runtime validation, canonicalization, policy, and deterministic compilation.
- Add snapshot, escaping, malicious-input, and limits tests.

Acceptance: supported fixtures compile reproducibly; code injection and unknown constructs are rejected.

### AR4 — Generation and bounded execution

- Add provider adapter, prompt version, reproduction StateGraph, durable records, cancellation, runner execution, classification, and revisions.

Acceptance: at least three distinct MiniShop reports produce executable candidates without reference-test access; selector failures never count as reproduction.

### AR5 — Review and frozen baseline

- Add review UI and hash-bound review endpoint.
- Freeze accepted content and dependencies, then rerun on unchanged source.

Acceptance: accepted tests cannot be swapped; revision requires reapproval and a fresh baseline.

### AR6 — Repair and proof integration

- Pass the accepted test into the repair graph.
- Preserve identical test identity after patch.
- Extend proof bundles with complete reproduction provenance.
- Disable all bypass actions on testless cases.

Acceptance: new report → accepted generated failure → reviewed patch → same-test pass → regression checks → proof bundle.

### AR7 — Held-out evaluation and release

- Freeze development/held-out splits before prompt tuning.
- Hide independent acceptance specs and reference fixes from models.
- Cover calculation, state, deletion, async, rendering, and multi-file bugs.
- Report all denominators, failures, unsupported cases, and infrastructure errors.
- Update README, demo, status, and architecture claims.

Required metrics: completeness, valid candidate, executable candidate, relevant reproduction, human acceptance, end-to-end verified repair, attempts, latency, usage/cost when configured, infrastructure error, and unsupported rates.

## Test matrix

Unit:

- Schema, canonicalization, hashes, compiler escaping, limits, transitions, classification, retry policy, report migration, and completeness.

Integration:

- API lifecycle, atomic persistence, restart recovery, cancellation, approval replay, stale hashes, corruption, compiler execution on controlled fixtures, and proof extraction.

Browser:

- Report creation/clarification, candidate review on desktop/mobile, assertion failure, passing baseline, selector error, navigation error, target outage, timeout, cancellation, and identical before/after test.

Adversarial:

- Prompt injection in report/page text, raw code, external URL, path traversal, CSS/XPath, excessive actions, prototype-pollution keys, changed inputs, and reference leakage.

## Evidence protocol

For every milestone:

1. Write a focused failing contract/reproduction.
2. Run it before implementation and confirm the intended failure.
3. Implement the smallest milestone-complete change.
4. Rerun the identical check.
5. Run relevant regression, typecheck, build, and browser checks.
6. Save manifests, logs, reports, screenshots/traces, and identities.
7. Update the progress tracker with executed evidence only.

Suggested root: `artifacts/arbitrary-reproduction/ar0-baseline/` through `ar7-evaluation/`.

## Estimate

With AI coding assistance and one focused developer:

| Scope | Estimate |
| --- | --- |
| AR0–AR3 safe foundation | 3–5 focused days |
| AR4–AR6 usable MiniShop workflow | 4–7 focused days |
| AR7 evaluation and portfolio packaging | 2–4 focused days |
| Total | Approximately 9–16 focused days |

These are planning estimates, not completion claims.

## Definition of done

- A dashboard-created case begins without a predefined test.
- The system derives a bounded candidate from the report and current target inventory.
- A human approves the exact candidate.
- The accepted test produces a structured, relevant failure on unchanged source.
- Test and dependencies are frozen and fingerprinted.
- Repair generation cannot access reference fixes.
- The exact accepted test passes after the reviewed patch.
- Required regression checks pass.
- The proof bundle independently verifies the full chain and hashes.
- Held-out evaluation retains all successes, failures, unsupported cases, and infrastructure errors.

