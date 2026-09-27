# Rida Zainab — Progress Tracker
### Track: React Dashboard · Branch: `feature/dashboard`

> Import types from `@bug-to-proof/shared-types`.
> Never modify `services/api/`, `apps/minishop/`, or `tests/playwright/`.
> API base URL: `http://localhost:3001` — configure via `VITE_API_BASE_URL` in `.env`.

---

## Overall Status

| Milestone | Status |
|-----------|--------|
| M0 — Contracts (shared) | ✅ Complete |
| M1 — Dashboard Shell | ✅ Complete |
| M2 — Connect to API | ✅ Complete |
| M3 — Patch Visualization | ✅ Complete |
| M4 — UX Polish | ✅ Complete |

---

## Work Summary

### What Was Already Implemented (by Abdullah Ijaz)

Abdullah implemented the full dashboard scaffold and all components on `feature/dashboard`:

| Component / File | Pre-existing state |
|---|---|
| `apps/dashboard/` — full Vite+React+TypeScript app | ✅ Scaffolded, routing, port 5173 |
| `src/api/client.ts` | ✅ Stub API client with all endpoint calls |
| `src/App.tsx` | ✅ Router setup (`/` and `/cases/:id`) |
| `src/components/CaseList.tsx` | ✅ Case rows with navigation |
| `src/components/CaseDetail.tsx` | ✅ Full case rendering, polling, actions |
| `src/components/BugReportForm.tsx` | ✅ Inline form, basic validation |
| `src/components/EvidencePanel.tsx` | ✅ Screenshot + trace links |
| `src/components/PatchViewer.tsx` | ✅ Diff rendering with color |
| `src/components/BeforeAfterComparison.tsx` | ✅ Side-by-side panels |
| `src/components/StatusBadge.tsx` | ✅ Colored status badge with pulse |
| `src/pages/CasesPage.tsx` | ✅ Case list + Demo Reset |
| `src/pages/CaseDetailPage.tsx` | ✅ Case detail with error handling |

### Issues Found and Fixed in This Session

#### 1. TypeScript Compilation Errors
- **Problem:** `ImportMeta.env` TS2339 error — Vite's `ImportMeta` augmentation not included.
- **Fix:** Added `"types": ["vite/client"]` to `apps/dashboard/tsconfig.json`.

#### 2. API Client (`src/api/client.ts`)
- **Problem:** Trailing-slash inconsistency in BASE URL; 202 responses not handled (were parsed as JSON, causing "Unexpected end of JSON" errors); no network error distinction; no `AbortSignal` support.
- **Fix:** Normalized BASE with `.replace(/\/$/, "")`, added `artifactUrl()` helper, handled 202 and 204 without body parsing, added network error catch, exported `API_BASE`, added `AbortSignal` parameters.

#### 3. CaseDetail — Polling Race Condition
- **Problem:** `setInterval` could send overlapping requests if a previous poll was still in-flight; no stale-response prevention when navigating between cases; silent polling failures left spinner indefinitely.
- **Fix:** Replaced `setInterval` with a `setTimeout` chain — next poll is scheduled only after the previous request completes. Added `currentCaseIdRef` to discard stale responses. Polling errors now surface as recoverable warnings while retaining last-known data.

#### 4. State Machine Gap: REPRODUCED → PATCH_PROPOSED
- **Problem:** The seed case has `status=REPRODUCED` + `patch.status=PROPOSED`. The old code only showed "Mark as Applied" when `status=PATCH_PROPOSED`, so the user was stuck — there was no UI action to advance from REPRODUCED to PATCH_PROPOSED.
- **Fix:** Added an **"Accept Proposed Patch"** button that sends `PATCH /api/cases/:id { status: "PATCH_PROPOSED" }` when `status=REPRODUCED && patch.status=PROPOSED`. Full sequence is now: Accept Proposed Patch → Mark as Applied → Run Verification.

#### 5. Demo Reset Location
- **Problem:** Demo Reset button was only on CasesPage (list), not on the case-001 detail view.
- **Fix:** Added Demo Reset button to CaseDetail header, visible only when `bugCase.id === "case-001"`. Includes accurate helper text explaining what is and is not reset.

#### 6. StatusBadge Colors
- **Problem:** Colors didn't match spec — REPRODUCING/VERIFYING were amber/yellow instead of blue; REPRODUCTION_FAILED/VERIFICATION_FAILED were purple instead of orange.
- **Fix:** Updated color map per spec. Added human-readable status labels (e.g., "REPRODUCED (bug confirmed)"). Added `role="status"` and `aria-label`. Added `prefers-reduced-motion` media query for pulse animation.

#### 7. BugReportForm
- **Problem:** Form was always visible inline; input not trimmed before submission; no navigation to created case; no Escape/focus keyboard handling.
- **Fix:** Converted to a modal dialog triggered by "+ New Bug Report" button. Added input trimming and proper empty-check before API call. Navigates to the new case on success using `useNavigate`. Preserves input on API failure. Escape key and backdrop-click close dialog. Focus trapping via autoFocus on title field.

#### 8. BeforeAfterComparison
- **Problem:** Hard-coded ❌ Before Patch and ✅ After Patch labels regardless of actual run results.
- **Fix:** Accepts `verification` prop and derives labels from `beforeRun.passed` and `afterRun.passed`. A failed before-run is labeled "Bug reproduced — baseline test failed." An after-run failure is labeled "Patch did not fix the bug." Shows "Not run yet." when no after evidence. Handles missing evidence gracefully.

#### 9. EvidencePanel
- **Problem:** URL constructed as `API_BASE + "/" + evidence.path` which duplicated the env var in the browser (not using the shared `artifactUrl()` helper); screenshot silently hidden on error.
- **Fix:** Uses `artifactUrl()` from `api/client.ts` for consistent URL construction. Screenshot load error now shows a visible "📷 Screenshot not yet available" placeholder instead of disappearing. Added `run` prop for pass/fail badge with expected/actual values. Separated trace links from other artifacts.

#### 10. PatchViewer
- **Problem:** File headers (`---`/`+++`) were treated as removal/addition lines (wrong color); no handling for empty diff; no helper text distinguishing "Mark as Applied" from actually patching MiniShop.
- **Fix:** `classifyDiffLine()` correctly identifies `---`/`+++` as file headers (gray). Handles absent diff gracefully. Displays patch status badge and timestamp. Added `ℹ️` helper text explaining the distinction between recording and applying.

#### 11. CaseDetailPage
- **Problem:** 404 errors displayed as a generic error message; no retry button; no Back link during loading state.
- **Fix:** Detects `status === 404` and shows a distinct "Case not found" card with a Back link. Error state has a Retry button. Back link shown during loading state.

#### 12. CasesPage
- **Problem:** Demo Reset button was using `alert()` for errors; no retry on load failure.
- **Fix:** Removed Demo Reset from CasesPage (now in CaseDetail for case-001). Added inline error card with Retry button for case-list load failures.

---

## Validation Results

### TypeScript Check
```
node_modules\.bin\tsc.cmd --noEmit --project apps\dashboard\tsconfig.json
# EXIT: 0 — no errors
```

### Production Build
```
npm run build --workspace=apps/dashboard
# vite v5.4.21 building for production...
# ✓ 44 modules transformed.
# dist/assets/index-BOqWaGv9.js  193.69 kB │ gzip: 60.84 kB
# ✓ built in 4.09s
# EXIT: 0
```

### API Runtime Tests (live against running API)
```
GET  /api/health                          → { status: "ok" }
GET  /api/cases                           → [case-001] ✅
POST /api/cases (new case)                → 201, id: case-1790505307017 ✅
POST /api/cases/case-001/reproduce        → 202 Accepted ✅
POST /api/demo/reset                      → case-001 REPRODUCED state ✅
PATCH /api/cases/case-001 REPRODUCED→PATCH_PROPOSED → 200 ✅
PATCH /api/cases/case-001 PATCH_PROPOSED→PATCH_APPLIED → 200 ✅
PATCH /api/cases/case-001 REPRODUCED→VERIFIED (invalid) → 409 ✅
```

### Dashboard Startup
```
npm run dev --workspace=apps/dashboard
# VITE v5.4.21 ready in 1319 ms
# Local: http://localhost:5173/
# EXIT: 0 (server running)
```
Dashboard serves HTML on port 5173 and API proxy (`/api`, `/artifacts`) routes to localhost:3001.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/dashboard/tsconfig.json` | Added `"types": ["vite/client"]` |
| `apps/dashboard/src/api/client.ts` | Normalized BASE, `artifactUrl()`, 202 handling, AbortSignal, network errors |
| `apps/dashboard/src/components/StatusBadge.tsx` | Corrected color map, readable labels, ARIA, reduced-motion |
| `apps/dashboard/src/components/BugReportForm.tsx` | Modal dialog, input trimming, navigation, keyboard handling |
| `apps/dashboard/src/components/CaseDetail.tsx` | setTimeout polling, stale prevention, state machine actions, Demo Reset, failure cards, manual refresh |
| `apps/dashboard/src/components/EvidencePanel.tsx` | artifactUrl(), screenshot fallback, run result badge |
| `apps/dashboard/src/components/PatchViewer.tsx` | Correct diff coloring, absent diff handling, status badge, helper text |
| `apps/dashboard/src/components/BeforeAfterComparison.tsx` | Derive labels from actual run data, missing evidence handling |
| `apps/dashboard/src/pages/CasesPage.tsx` | Removed Demo Reset (now in CaseDetail), added retry button |
| `apps/dashboard/src/pages/CaseDetailPage.tsx` | 404 vs error distinction, retry button, Back link during loading |

---

## Demo Steps

```bash
# Terminal 1 — API
cd bug-to-proof
npx tsx services/api/src/index.ts
# → API running on http://localhost:3001

# Terminal 2 — Dashboard  
cd bug-to-proof
npm run dev --workspace=apps/dashboard
# → Dashboard on http://localhost:5173

# (Optional) Terminal 3 — MiniShop (needed for live reproduction runs)
npm run dev --workspace=apps/minishop
# → MiniShop on http://localhost:5174
```

### Demo Walkthrough (case-001)
1. Open `http://localhost:5173/` → case list with case-001 showing **REPRODUCED (bug confirmed)** badge
2. Click case-001 → detail view with root cause, reproduction steps, evidence, and proposed patch
3. Scroll to Proposed Patch section → see diff with color-coded `+`/`-` lines
4. Click **Accept Proposed Patch** → advances to PATCH PROPOSED
5. Click **Mark as Applied** → helper text explains this records, not applies, the patch → status → PATCH APPLIED
6. Click **Run Verification** → status shows blue pulse "VERIFYING", polling starts
7. After run completes → status shows VERIFIED (if patched MiniShop running) or VERIFICATION FAILED
8. Before/After Comparison shows both runs with labels derived from actual results
9. Click **↺ Demo Reset** on the case header → resets to seed REPRODUCED state
10. Click **+ New Bug Report** → modal opens, fill title + description, submit → navigates to new case

---

## Integration Blockers

| Blocker | Owner | Observed behavior | Expected behavior |
|---------|-------|-------------------|-------------------|
| Before screenshot not committed | Sikander | `artifacts/case-001/before/screenshot.png` not present — image shows "📷 Screenshot not yet available" placeholder | Sikander should commit screenshot from failing Playwright run |
| Before trace not committed | Sikander | `artifacts/case-001/before/trace.zip` not present — link renders but 404s | Sikander should commit trace from failing Playwright run |
| Verification after-run (live end-to-end) | Sikander + Abdullah | POST /api/cases/:id/reproduce transitions to REPRODUCED immediately (no MiniShop) when MiniShop not running; runner transitions REPRODUCTION_FAILED not REPRODUCED when the test fails to connect | Sikander's patched MiniShop on port 5174 needed for live verification run |
| REPRODUCTION_FAILED when MiniShop not running | Abdullah (known) | Runner fails with REPRODUCTION_FAILED when MiniShop unreachable — this is the documented behavior | For live demo, ensure `npm run dev:minishop` is running before triggering reproduction |
| `npm run dev:api` exits silently | Abdullah | Workspace script exits; workaround: `npx tsx services/api/src/index.ts` from root | Abdullah documented fix options in PROGRESS-abdullah.md |

---

## Notes

- The `data/cases/case-001.json` `updatedAt` field changed during API integration testing (state machine tests ran against the live API). The case was reset back to the REPRODUCED seed state. This is a runtime artifact, not a code change.
- `package-lock.json` changed because `npm install` was needed (node_modules was absent). This is an expected lockfile update.
- No teammate files were edited. No API, MiniShop, Playwright, or shared-types files were modified.
- Full end-to-end verification with VERIFIED outcome depends on Sikander applying the patch to MiniShop and running the Playwright verification test.
