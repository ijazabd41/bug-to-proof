# Arbitrary bug reproduction progress

Plan: [plans/arbitrary-bug-reproduction-plan.md](../../plans/arbitrary-bug-reproduction-plan.md)  
Status: **PLANNED — implementation not started**  
Last updated: 2026-10-12 (Asia/Karachi)

## Current capability boundary

- New reports are persisted and displayed.
- Optional report fields are currently concatenated into the description by the dashboard.
- New cases are created with `reproduction.testFile: ""`.
- Reproduction and dynamic repair endpoints reject cases without a configured test.
- Existing predefined benchmark cases can use the evidence-backed repair workflow.
- No generated definition, compiler, test review, frozen generated baseline, or arbitrary-report evaluation exists yet.

## Milestones

| ID | Deliverable | Status | Evidence |
| --- | --- | --- | --- |
| AR0 | Documentation, contracts, and baseline | IN PROGRESS | Documentation index and implementation plan created; executable baseline still required |
| AR1 | First-class report structure and completeness | NOT STARTED | — |
| AR2 | Target discovery inventory | NOT STARTED | — |
| AR3 | Declarative DSL and deterministic compiler | NOT STARTED | — |
| AR4 | Candidate generation and bounded execution | NOT STARTED | — |
| AR5 | Human review and frozen baseline | NOT STARTED | — |
| AR6 | Repair graph and proof-bundle integration | NOT STARTED | — |
| AR7 | Held-out evaluation and portfolio release | NOT STARTED | — |

## AR0 checklist

- [x] Inventory existing documentation and capability claims.
- [x] Create an authoritative documentation index.
- [x] Define bounded product scope and honest outcomes.
- [x] Design the run model, API, DSL, compiler, graph, UI, isolation, and evidence protocol.
- [ ] Add focused tests proving a new case cannot reproduce without a test.
- [ ] Record pre-implementation typecheck, unit, build, and browser baseline under `artifacts/arbitrary-reproduction/ar0-baseline/`.
- [ ] Define contracts in code without changing behavior.
- [ ] Review and freeze AR0 contracts before AR1.

## Progress update rules

- Mark a task complete only after its acceptance check runs.
- Link the exact artifact directory and command result.
- Record infrastructure errors separately from product failures.
- Repeat the relevant baseline whenever a test or definition changes.
- Never count simulated output as live-model accuracy.
- Never count selector, setup, timeout, or target-start errors as reproduced bugs.

## Latest evidence

- Dashboard unit tests: 5 passed, 0 failed (`artifacts/ui-improvements-unit.json`).
- Dashboard browser checks: 2 passed (`artifacts/ui-redesign/f1179c19-a3b3-46bc-be9a-4c8e6ccc3b88/`).
- These validate the UI and report payload only; they do not validate automatic reproduction.

