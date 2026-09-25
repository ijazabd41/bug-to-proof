# Abdullah Ijaz — Progress Tracker
### Track: Node.js API + LLM · Branch: `feature/api`

> Own: `services/api/`, `packages/shared-types/` (types already frozen), `data/cases/`
> Never modify `apps/dashboard/` components or `apps/minishop/`.
> You are the integration owner — your API is the contract everyone else depends on.

---

## Overall Status

| Milestone | Status |
|-----------|--------|
| M0 — Contracts | ✅ Complete |
| M1 — API Foundation | ⬜ Pending |
| M2 — Runner + LLM | ⬜ Pending |
| M3 — Patch State Handling | ⬜ Pending |
| M4 — Integration & Demo Setup | ⬜ Pending |

---

## Milestone 0 — Contracts ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| Root `package.json` with workspaces | `package.json` | ✅ |
| `tsconfig.base.json` | `tsconfig.base.json` | ✅ |
| `.gitignore` | `.gitignore` | ✅ |
| `.env.example` | `.env.example` | ✅ |
| Shared types | `packages/shared-types/src/index.ts` | ✅ |
| `data/cases/.gitkeep` | `data/cases/.gitkeep` | ✅ |
| `artifacts/.gitkeep` | `artifacts/.gitkeep` | ✅ |
| `README.md` skeleton | `README.md` | ✅ |
| `npm install` clean | — | ✅ |
| TypeScript check on shared types | — | ✅ |

---

## Milestone 1 — API Foundation
**Goal:** Express API running on port 3001 with full case CRUD and a seeded demo case.

### Tasks

- [ ] **M1-A1** Scaffold `services/api/` — init `package.json`, install `express`, `cors`, `dotenv`, `tsx` (or `ts-node`), `nodemon`
- [ ] **M1-A2** Create `services/api/tsconfig.json` extending `../../tsconfig.base.json` with `"module": "CommonJS"` (Node.js needs CJS)
- [ ] **M1-A3** Create `services/api/src/index.ts` — Express app, mount routes, serve `artifacts/` as static, start on `API_PORT`
- [ ] **M1-A4** Create `services/api/src/storage/caseStore.ts`:
  - `readCase(id)` — reads `data/cases/<id>.json`, returns `BugCase | null`
  - `readAllCases()` — reads all `.json` files in `data/cases/`, returns `BugCase[]`
  - `writeCase(bugCase)` — writes atomically (write to `.tmp` then rename) to `data/cases/<id>.json`
  - `deleteCase(id)` — deletes the file
- [ ] **M1-A5** Create `services/api/src/routes/cases.ts` with all case endpoints:
  - `GET /api/cases` → `readAllCases()`
  - `POST /api/cases` → generate ID, create `BugCase`, call LLM Call 1 async, `writeCase()`
  - `GET /api/cases/:id` → `readCase(id)`
  - `PATCH /api/cases/:id` → merge partial update, `writeCase()`
  - `DELETE /api/cases/:id` → `deleteCase(id)`, remove `artifacts/<id>/` directory
- [ ] **M1-A6** Configure CORS: allow `http://localhost:5173`
- [ ] **M1-A7** Configure `express.static` for `ARTIFACTS_DIR` at route `/artifacts`
- [ ] **M1-A8** Create `services/api/src/middleware/errorHandler.ts` — catches errors, returns `{ error, details }`
- [ ] **M1-A9** Add case ID validation: alphanumeric + hyphens only, max 50 chars — reject anything else with 400
- [ ] **M1-A10** Create seeded `data/cases/case-001.json` with status `REPRODUCED` and `patch` pre-populated at `PROPOSED`
  - Include `reproduction.steps`, `expected`, `actual`, `testFile`
  - Include `reproduction.lastRun` with `passed: false` and evidence IDs
  - Include `evidence` array with before screenshot + trace entries
- [ ] **M1-A11** Confirm `npm run dev:api` starts on port 3001 with no errors
- [ ] **M1-A12** Test manually: `curl http://localhost:3001/api/cases` returns the seeded case

### Files to Create

| File | Notes |
|------|-------|
| `services/api/package.json` | Workspace package |
| `services/api/tsconfig.json` | Extends base, CJS module |
| `services/api/src/index.ts` | Express entry point |
| `services/api/src/routes/cases.ts` | Case CRUD routes |
| `services/api/src/storage/caseStore.ts` | Atomic JSON read/write |
| `services/api/src/middleware/errorHandler.ts` | Global error handler |
| `data/cases/case-001.json` | Seeded demo case |

### Acceptance Criteria

- `npm run dev:api` starts on port 3001 ✓
- `GET /api/cases` returns `[case-001]` ✓
- `POST /api/cases` creates a new case and persists it ✓
- `PATCH /api/cases/case-001` updates and persists correctly ✓
- `GET /artifacts/case-001/before/screenshot.png` serves the file (once artifact exists) ✓
- Invalid case IDs return 400 ✓
- Missing case returns 404 ✓

---

## Milestone 2 — Playwright Runner + LLM
**Goal:** Reproduce and verify endpoints spawn Playwright and save evidence. LLM client wired up.

### Tasks

#### LLM Client

- [ ] **M2-A1** Create `services/api/src/llm/client.ts`:
  - Read `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_ENABLED` from env
  - Export `callLLM(prompt: string, timeoutMs = 10000): Promise<string>`
  - **If `LLM_API_KEY` is absent/empty or `LLM_ENABLED !== "true"` → return `""` immediately** (no network call)
  - Wrap fetch in try/catch + `AbortController` timeout — always return safe fallback, never throw
  - Log warnings (not errors) when skipped or failed

#### Reproduction & Verification Routes

- [ ] **M2-A2** Create `services/api/src/runner/playwrightRunner.ts`:
  - Export `runTest(caseId, testFile, phase: "before" | "after"): Promise<RunResult>`
  - First: HTTP HEAD to `http://localhost:5174` — if unreachable, return error immediately
  - Spawn: `npx playwright test <testFile> --reporter=json` with env `{ PHASE, CASE_ID }`
  - Capture stdout/stderr, parse JSON reporter output
  - Return `RunResult { passed, expected, actual, durationMs, artifactPaths, rawOutput }`
- [ ] **M2-A3** Create `services/api/src/routes/reproduce.ts`:
  - `POST /api/cases/:id/reproduce`
  - Validate: case must exist; status must not be `REPRODUCING` or `VERIFYING` (409 otherwise)
  - Set status → `REPRODUCING`, save
  - Fire async: `runTest(id, reproduction.testFile, "before")`
  - On result: save evidence to `artifacts/<id>/before/`, append evidence items, update `reproduction.lastRun`
  - If `passed === false` → status → `REPRODUCED` + fire LLM Call 3 (root cause) async
  - If `passed === true` → status → `REPRODUCTION_FAILED` (test unexpectedly passed)
  - Return `202` immediately before async work starts
- [ ] **M2-A4** Create `services/api/src/routes/verify.ts`:
  - `POST /api/cases/:id/verify`
  - Validate: status must be `PATCH_APPLIED` (409 otherwise)
  - Set status → `VERIFYING`, save
  - Fire async: `runTest(id, reproduction.testFile, "after")`
  - On result: save evidence to `artifacts/<id>/after/`, append evidence, update `verification.afterRun`
  - If `passed === true` → status → `VERIFIED`
  - If `passed === false` → status → `VERIFICATION_FAILED`
  - Return `202` immediately
- [ ] **M2-A5** Add sub-routes to `routes/cases.ts`:
  - `GET /api/cases/:id/reproduction` → returns `{ reproduction, evidence: beforeEvidence }`
  - `GET /api/cases/:id/evidence` → returns all `Evidence[]` for the case
  - `GET /api/cases/:id/verification` → returns `{ verification, evidence: afterEvidence }`
- [ ] **M2-A6** Mount reproduce and verify routes in `src/index.ts`

#### LLM Calls 1 & 3

- [ ] **M2-A7** LLM Call 1 — Bug Report Structuring (in `routes/cases.ts` POST handler):
  - After case is created with raw description, call `callLLM()` async
  - Prompt: extract `preconditions`, `steps`, `expected`, `actual` from description
  - Parse JSON response; if valid, update `case.reproduction` (keep `testFile` and `lastRun` null)
  - Fallback: leave `reproduction` with raw description as single step
- [ ] **M2-A8** LLM Call 3 — Root Cause Explanation (in reproduce route, after status → REPRODUCED):
  - Call `callLLM()` async with bug title, description, expected, actual
  - Prompt: write 3-4 sentence root cause paragraph
  - Store plain string in `case.rootCauseExplanation`
  - Fallback: leave `rootCauseExplanation` as `null`

### Files to Create / Modify

| File | Change |
|------|--------|
| `services/api/src/llm/client.ts` | New — LLM client |
| `services/api/src/runner/playwrightRunner.ts` | New — Playwright spawn + parse |
| `services/api/src/routes/reproduce.ts` | New — reproduce endpoint |
| `services/api/src/routes/verify.ts` | New — verify endpoint |
| `services/api/src/routes/cases.ts` | Add sub-routes + LLM Call 1 |
| `services/api/src/index.ts` | Mount new routes |

### Acceptance Criteria

- `POST /api/cases/case-001/reproduce` returns 202 ✓
- Case transitions `REPRODUCING → REPRODUCED` (or `REPRODUCTION_FAILED`) ✓
- `artifacts/case-001/before/` created with screenshot + result.json ✓
- `GET /api/cases/case-001/evidence` returns evidence items ✓
- LLM client returns `""` silently when no key is set ✓
- LLM Call 1 populates `reproduction.steps` when LLM is enabled ✓
- LLM Call 3 populates `rootCauseExplanation` after REPRODUCED ✓
- MiniShop-not-running returns informative 409 (not a 500) ✓

---

## Milestone 3 — Patch State Handling
**Goal:** Patch CRUD, state machine enforcement, LLM Call 2 wired up. Full seeded case-001 JSON.

### Tasks

- [ ] **M3-A1** Enforce valid status transitions in `PATCH /api/cases/:id`:
  - Only allow advancing to `PATCH_APPLIED` from `PATCH_PROPOSED` or `REPRODUCED`
  - Only allow `VERIFYING` to be set by the internal verify route (not via external PATCH)
  - Return 409 with descriptive message on invalid transitions
- [ ] **M3-A2** LLM Call 2 — Patch Summary (in `routes/cases.ts` PATCH handler):
  - Trigger when request includes `patch.diff` for the first time
  - Prompt: given diff + description, write `summary` (1 sentence) + `reasoning` (2-3 sentences)
  - If LLM returns valid JSON, overwrite `patch.summary` and `patch.reasoning`
  - Fallback: keep whatever summary was provided in the request body
- [ ] **M3-A3** Ensure `verification.afterRun` is correctly saved after verify run completes
- [ ] **M3-A4** Finalize `data/cases/case-001.json` with complete seeded data:
  - `status: "REPRODUCED"`
  - `reproduction` with all fields including `lastRun` (before run, passed: false)
  - `patch` with `status: "PROPOSED"` and a real unified diff
  - `verification.beforeRun` populated, `afterRun: null`
  - `evidence` array with before screenshot + trace items
  - `rootCauseExplanation` pre-filled
- [ ] **M3-A5** Add `POST /api/demo/reset` endpoint:
  - Reads the committed `data/cases/case-001.json` baseline from `data/cases/case-001.seed.json`
  - Copies it over `data/cases/case-001.json`
  - Returns the reset case
  - (Store original seed as `case-001.seed.json` so runtime writes don't overwrite it)

### Files to Modify / Create

| File | Change |
|------|--------|
| `services/api/src/routes/cases.ts` | State machine + LLM Call 2 |
| `services/api/src/storage/caseStore.ts` | Atomic write review |
| `data/cases/case-001.json` | Fully seeded with all fields |
| `data/cases/case-001.seed.json` | Immutable seed for demo reset |
| `services/api/src/routes/demo.ts` | New — demo reset endpoint |
| `services/api/src/index.ts` | Mount demo route |

### Acceptance Criteria

- Advancing to `PATCH_APPLIED` from wrong state returns 409 ✓
- LLM Call 2 overwrites `patch.summary`/`reasoning` when enabled ✓
- `POST /api/demo/reset` restores case-001 to REPRODUCED state ✓
- `data/cases/case-001.json` contains complete realistic demo data ✓

---

## Milestone 4 — Integration & Demo Setup
**Goal:** All services run together, demo is reliable, README is complete.

### Tasks

- [ ] **M4-A1** Full integration test: start all three services (`npm run dev`), walk through entire workflow manually
- [ ] **M4-A2** Fix any integration issues found in the above test
- [ ] **M4-A3** Verify `npm run demo` starts all services and case-001 is accessible
- [ ] **M4-A4** Verify `POST /api/demo/reset` works from the dashboard Demo Reset button
- [ ] **M4-A5** Finalize `README.md` — prerequisites, setup steps, quick start, architecture summary
- [ ] **M4-A6** Confirm all three service ports start without conflict (`5173`, `3001`, `5174`)

### Acceptance Criteria

- `npm install && npm run dev` starts all three services with no errors ✓
- Demo reset endpoint restores case-001 cleanly ✓
- README is clear enough for a judge to set up in under 5 minutes ✓

---

## Key Contracts You Own

### State Machine (enforce in `routes/cases.ts`)

```
REPORTED → READY_TO_REPRODUCE → REPRODUCING → REPRODUCED
REPRODUCING → REPRODUCTION_FAILED
REPRODUCED → PATCH_PROPOSED → PATCH_APPLIED → VERIFYING → VERIFIED
VERIFYING → VERIFICATION_FAILED
```

External PATCH requests may only move between: `REPORTED → READY_TO_REPRODUCE → PATCH_PROPOSED → PATCH_APPLIED`
The runner sets: `REPRODUCING`, `REPRODUCED`, `REPRODUCTION_FAILED`, `VERIFYING`, `VERIFIED`, `VERIFICATION_FAILED`

### Artifact Write Convention

```
artifacts/<caseId>/before/screenshot.png   ← Playwright writes
artifacts/<caseId>/before/trace.zip        ← Playwright writes
artifacts/<caseId>/before/result.json      ← Runner saves parsed output
artifacts/<caseId>/after/screenshot.png
artifacts/<caseId>/after/trace.zip
artifacts/<caseId>/after/result.json
```

### Evidence ID Format

```
ev-<caseId>-<phase>-<type>   e.g. ev-case-001-before-screenshot
```

---

## Blocked / Waiting On

> Update this section as you work.

| Blocker | Waiting on | Status |
|---------|-----------|--------|
| MiniShop running for integration tests | Rida Zainab — M1 | ⬜ |
| Playwright spec path for `testFile` field | Rida Zainab — M2 spec path | ⬜ |
| After artifacts for case-001 seed | Rida Zainab — M3 after run | ⬜ |
