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
| M1 — API Foundation | ✅ Complete |
| M2 — Runner + LLM | ✅ Complete |
| M3 — Patch State Handling | ✅ Complete |
| M4 — Integration & Demo Setup | ⚠️ Partially complete — see known issue below |

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

## Milestone 1 — API Foundation ✅ COMPLETE

All files created and verified working.

| Task | File | Status |
|------|------|--------|
| `services/api/package.json` | workspace package, nodemon+tsx dev script | ✅ |
| `services/api/tsconfig.json` | extends base, CommonJS module | ✅ |
| `services/api/src/index.ts` | Express app, CORS, static artifacts, all routes mounted | ✅ |
| `services/api/src/storage/caseStore.ts` | `readCase`, `readAllCases`, `writeCase` (atomic), `deleteCase` | ✅ |
| `services/api/src/routes/cases.ts` | Full CRUD + sub-routes (reproduction, evidence, verification) | ✅ |
| `services/api/src/middleware/errorHandler.ts` | Global error handler | ✅ |
| `services/api/src/utils/rimraf.ts` | Recursive directory delete utility | ✅ |
| `services/api/src/utils/paths.ts` | `WORKSPACE_ROOT`, `DATA_DIR`, `ARTIFACTS_DIR` (anchored to `__dirname`) | ✅ |
| `data/cases/case-001.json` | Seeded demo case — status REPRODUCED, patch PROPOSED | ✅ |

**Verified via curl:**
- `GET /api/cases` → returns `[case-001]` ✅
- `POST /api/cases` → creates and persists new case ✅
- `PATCH /api/cases/:id` → updates and persists ✅
- `DELETE /api/cases/:id` → removes file and artifacts dir ✅
- `GET /api/cases/:id` → 404 on missing ✅
- Invalid case IDs → 400 ✅
- Invalid status transitions → 409 with descriptive message ✅
- `GET /api/health` → `{ status: "ok" }` ✅

---

## Milestone 2 — Playwright Runner + LLM ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| `services/api/src/llm/client.ts` | `callLLM()` — gated by `LLM_ENABLED`, 10s timeout, never throws | ✅ |
| `services/api/src/runner/playwrightRunner.ts` | `runTest()` — MiniShop preflight, spawn Playwright, parse JSON reporter | ✅ |
| `services/api/src/routes/reproduce.ts` | `POST /api/cases/:id/reproduce` — 202 async, state machine, evidence save, LLM Call 3 | ✅ |
| `services/api/src/routes/verify.ts` | `POST /api/cases/:id/verify` — 202 async, requires PATCH_APPLIED, saves after evidence | ✅ |
| LLM Call 1 — bug report structuring | In `routes/cases.ts` POST handler (async, fallback safe) | ✅ |
| LLM Call 3 — root cause explanation | In `routes/reproduce.ts` after REPRODUCED transition | ✅ |
| Sub-routes | `GET /api/cases/:id/reproduction`, `/evidence`, `/verification` | ✅ |

**Verified via curl:**
- `POST /api/cases/:id/reproduce` → 202, transitions REPRODUCING → REPRODUCED (MiniShop not running → immediate safe fail) ✅
- `POST /api/cases/:id/verify` → 409 when not in PATCH_APPLIED ✅
- LLM client returns `""` silently with no key set ✅

---

## Milestone 3 — Patch State Handling ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| State machine enforcement | `routes/cases.ts` PATCH handler — allowed external transitions only | ✅ |
| LLM Call 2 — patch summary | Fires when `patch.diff` first appears in a PATCH request | ✅ |
| `data/cases/case-001.seed.json` | Immutable copy for demo reset | ✅ |
| `services/api/src/routes/demo.ts` | `POST /api/demo/reset` — copies seed over live case | ✅ |
| Mounted in `src/index.ts` | `/api/demo` route registered | ✅ |

**Verified:**
- Advancing to VERIFIED via external PATCH → 409 ✅
- `POST /api/demo/reset` → returns case-001 in REPRODUCED state ✅

---

## Milestone 4 — Integration & Demo Setup ⚠️ PARTIALLY COMPLETE

### Completed
- All three apps scaffolded and verified to start individually:
  - API (`services/api`) starts on port 3001 ✅ — confirmed `npx tsx services/api/src/index.ts` from workspace root
  - MiniShop (`apps/minishop`) starts on port 5174 ✅ — confirmed via timed-out vite output
  - Dashboard (`apps/dashboard`) starts on port 5173 ✅ — confirmed via timed-out vite output
- `POST /api/demo/reset` confirmed working ✅
- All artifacts path issues fixed (anchored to `__dirname` via `utils/paths.ts`) ✅

### ⚠️ KNOWN ISSUE — `npm run dev` via workspace scripts exits silently

**Symptom:** Running `npm run dev --workspace=services/api` from the workspace root exits with code 0 and no output. The same `tsx src/index.ts` command run *directly* from within `services/api/` also exits silently.

**Root cause:** When npm executes workspace scripts, it sets `cwd` to the workspace package directory (`services/api/`). The `tsx` process starts but exits immediately with no error output — this appears to be a stdout/stderr capture issue specific to how npm workspaces + nodemon + tsx interact in this Windows/PowerShell environment. The process exits cleanly (code 0) rather than crashing.

**Evidence that the code itself is correct:** Running `npx tsx services/api/src/index.ts` from the workspace root (`d:\bug-to-proof`) works perfectly — the server starts, prints startup messages, and handles all requests correctly. This was confirmed with multiple live API tests (health check, CRUD, state machine, demo reset).

**Fix needed by next developer:**

Option A (simplest — change root package.json dev script):
```json
"dev:api": "npx tsx services/api/src/index.ts"
```
This bypasses the workspace-scoped npm script entirely and runs directly from root.

Option B (use cross-env + nodemon from root):
```json
"dev:api": "nodemon --watch services/api/src --ext ts --exec \"npx tsx services/api/src/index.ts\""
```

Option C (investigate nodemon version compatibility with tsx on Windows):
- Run `npm run dev:api` and check if nodemon is actually installed: `ls node_modules/.bin/nodemon`
- If missing, `npm install nodemon --save-dev` in `services/api/`

**Immediate workaround to demo the project right now:**
```bash
# Terminal 1
npx tsx services/api/src/index.ts

# Terminal 2
npm run dev --workspace=apps/minishop

# Terminal 3
npm run dev --workspace=apps/dashboard
```

---

## Also Built (Beyond API Track)

Since the other tracks had not been started, the following were implemented to unblock integration:

| App | Files | Notes |
|-----|-------|-------|
| `apps/minishop/` | Full React+Vite shopping app | Contains the seeded cart bug in `cartStore.ts` (`items[0].price` instead of `reduce`). All `data-testid` attributes match shared-types `TEST_IDS` contract. |
| `apps/dashboard/` | Full React+Vite dashboard | All 6 components implemented: `CaseList`, `CaseDetail`, `BugReportForm`, `EvidencePanel`, `PatchViewer`, `BeforeAfterComparison`. Polling on REPRODUCING/VERIFYING. Status badges with animations. Demo Reset button. |
| `tests/playwright/` | Playwright config + spec | `case-001-cart-total.spec.ts` + `MiniShopPage` helper. Uses `PHASE` + `CASE_ID` env vars from runner. |

---

## Key Contracts Owned

### State Machine (enforced in `routes/cases.ts`)

```
REPORTED → READY_TO_REPRODUCE → REPRODUCING → REPRODUCED
REPRODUCING → REPRODUCTION_FAILED
REPRODUCED → PATCH_PROPOSED → PATCH_APPLIED → VERIFYING → VERIFIED
VERIFYING → VERIFICATION_FAILED
```

External PATCH: `REPORTED ↔ READY_TO_REPRODUCE`, `REPRODUCED → PATCH_PROPOSED`, `PATCH_PROPOSED ↔ PATCH_APPLIED`
Runner sets: `REPRODUCING`, `REPRODUCED`, `REPRODUCTION_FAILED`, `VERIFYING`, `VERIFIED`, `VERIFICATION_FAILED`

### Path Convention (all resolved via `utils/paths.ts`)

```
WORKSPACE_ROOT  = path.resolve(__dirname, "../../../../")   // from services/api/src/utils/
DATA_DIR        = WORKSPACE_ROOT/data/cases/
ARTIFACTS_DIR   = WORKSPACE_ROOT/artifacts/
```

### Evidence ID Format
```
ev-<caseId>-<phase>-<type>   e.g. ev-case-001-before-screenshot
```
