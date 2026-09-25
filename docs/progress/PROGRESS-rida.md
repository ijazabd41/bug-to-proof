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
| M1 — Dashboard Shell | ⬜ Pending |
| M2 — Connect to API | ⬜ Pending |
| M3 — Patch Visualization | ⬜ Pending |
| M4 — UX Polish | ⬜ Pending |

---

## Milestone 0 — Contracts ✅ COMPLETE (done by Abdullah Ijaz)

Nothing to do — contracts already committed to `main`.
Pull `main` into your branch before starting M1.

```bash
git checkout main
git pull
git checkout -b feature/dashboard
```

---

## Milestone 1 — Dashboard Shell
**Goal:** A running Vite app on port 5173 with routing and mock data.

### Tasks

- [ ] **M1-S1** Scaffold `apps/dashboard/` with `npm create vite@latest` (React + TypeScript)
- [ ] **M1-S2** Install dependencies: `react-router-dom`, Tailwind CSS (or plain CSS)
- [ ] **M1-S3** Configure Vite to run on port 5173 (`server.port = 5173` in `vite.config.ts`)
- [ ] **M1-S4** Create `apps/dashboard/src/App.tsx` with React Router routes:
  - `/` → `CasesPage`
  - `/cases/:id` → `CaseDetailPage`
- [ ] **M1-S5** Create `apps/dashboard/src/api/client.ts` with stub functions returning mock `BugCase` data
- [ ] **M1-S6** Create `apps/dashboard/src/components/CaseList.tsx` — renders case rows from prop
- [ ] **M1-S7** Create `apps/dashboard/src/pages/CasesPage.tsx` — uses `CaseList` with mock data
- [ ] **M1-S8** Create `apps/dashboard/src/components/CaseDetail.tsx` — shell with placeholder sections:
  1. Bug Report
  2. Reproduction Steps
  3. Reproduction Result
  4. Failure Evidence
  5. Proposed Patch
  6. Patch Status
  7. Verification Result
  8. Before/After Comparison
- [ ] **M1-S9** Create `apps/dashboard/src/pages/CaseDetailPage.tsx` — fetches case by ID, renders `CaseDetail`
- [ ] **M1-S10** Confirm `npm run dev:dashboard` starts on port 5173 with no errors

### Files to Create

| File | Notes |
|------|-------|
| `apps/dashboard/package.json` | Workspace package |
| `apps/dashboard/vite.config.ts` | Port 5173, proxy `/api` → `localhost:3001` |
| `apps/dashboard/tsconfig.json` | Extends `../../tsconfig.base.json` |
| `apps/dashboard/index.html` | Vite entry |
| `apps/dashboard/src/main.tsx` | React root |
| `apps/dashboard/src/App.tsx` | Router setup |
| `apps/dashboard/src/api/client.ts` | API client (stubs first) |
| `apps/dashboard/src/components/CaseList.tsx` | List component |
| `apps/dashboard/src/components/CaseDetail.tsx` | Detail shell |
| `apps/dashboard/src/pages/CasesPage.tsx` | Cases list page |
| `apps/dashboard/src/pages/CaseDetailPage.tsx` | Case detail page |
| `apps/dashboard/src/types/index.ts` | Re-export from `@bug-to-proof/shared-types` |

### Acceptance Criteria

- `npm run dev:dashboard` starts on port 5173 ✓
- Cases list page renders with mock data ✓
- Clicking a case navigates to the detail page ✓
- No TypeScript errors ✓

---

## Milestone 2 — Connect to API
**Goal:** Dashboard shows real data, polling works, new cases can be created.

### Tasks

- [ ] **M2-S1** Replace all stubs in `api/client.ts` with real `fetch` calls to `http://localhost:3001`
- [ ] **M2-S2** Implement polling: while `case.status === "REPRODUCING" || "VERIFYING"`, poll `GET /api/cases/:id` every 2 seconds
- [ ] **M2-S3** Create `apps/dashboard/src/components/BugReportForm.tsx` — modal with title + description fields
- [ ] **M2-S4** Wire form submission to `POST /api/cases`, redirect to new case detail on success
- [ ] **M2-S5** Expand `CaseDetail.tsx` to render all real fields from `BugCase`:
  - Title, description, status badge, timestamps
  - Reproduction steps as ordered list
  - Expected vs actual from `reproduction.lastRun`
  - `rootCauseExplanation` paragraph (hide section if null)
- [ ] **M2-S6** Create `apps/dashboard/src/components/EvidencePanel.tsx`:
  - Shows screenshot image (`<img>` from artifact URL)
  - Shows trace download link
  - Shows test pass/fail badge with expected/actual values
- [ ] **M2-S7** Add "Run Reproduction" button → calls `POST /api/cases/:id/reproduce`, disables while REPRODUCING
- [ ] **M2-S8** Display status badge with correct colors per `CaseStatus`
- [ ] **M2-S9** Show spinner/loading state during polling

### Files to Modify / Create

| File | Change |
|------|--------|
| `apps/dashboard/src/api/client.ts` | Replace stubs with real fetch |
| `apps/dashboard/src/components/BugReportForm.tsx` | New |
| `apps/dashboard/src/components/EvidencePanel.tsx` | New |
| `apps/dashboard/src/components/CaseDetail.tsx` | Full real data rendering |
| `apps/dashboard/src/pages/CasesPage.tsx` | Add "New Case" button |
| `apps/dashboard/src/pages/CaseDetailPage.tsx` | Add polling logic |

### Acceptance Criteria

- Dashboard shows real `case-001` data from the API ✓
- Creating a new case via the form creates it in the API and navigates to it ✓
- "Run Reproduction" button triggers the API and shows spinner ✓
- Once REPRODUCED, screenshot from `artifacts/case-001/before/` appears ✓
- `rootCauseExplanation` paragraph appears when populated by LLM ✓

---

## Milestone 3 — Patch Visualization
**Goal:** Patch diff, before/after screenshots, and verification flow all work in the UI.

### Tasks

- [ ] **M3-S1** Create `apps/dashboard/src/components/PatchViewer.tsx`:
  - Display `patch.summary` and `patch.reasoning` above the diff
  - Render unified diff in a monospace code block with `+`/`-` line coloring
  - Show `patch.status` badge (PROPOSED / APPLIED)
- [ ] **M3-S2** Add "Mark as Applied" button in `CaseDetail.tsx`:
  - Visible only when `patch.status === "PROPOSED"`
  - Calls `PATCH /api/cases/:id` with `{ status: "PATCH_APPLIED", patch: { ...existing, status: "APPLIED", appliedAt: now } }`
- [ ] **M3-S3** Create `apps/dashboard/src/components/BeforeAfterComparison.tsx`:
  - Side-by-side screenshots (before phase left, after phase right)
  - ❌ FAILED badge on before, ✅ PASSED badge on after
  - Expected/actual values under each screenshot
- [ ] **M3-S4** Add "Run Verification" button in `CaseDetail.tsx`:
  - Enabled only when `case.status === "PATCH_APPLIED"`
  - Calls `POST /api/cases/:id/verify`
  - Disables and shows spinner while `status === "VERIFYING"`
- [ ] **M3-S5** Show `BeforeAfterComparison` once `verification.afterRun` is populated

### Files to Modify / Create

| File | Change |
|------|--------|
| `apps/dashboard/src/components/PatchViewer.tsx` | New |
| `apps/dashboard/src/components/BeforeAfterComparison.tsx` | New |
| `apps/dashboard/src/components/CaseDetail.tsx` | Add patch + verification sections |
| `apps/dashboard/src/api/client.ts` | Add patch/verify API calls |

### Acceptance Criteria

- Patch diff renders with `+`/`-` line coloring ✓
- "Mark as Applied" advances status to PATCH_APPLIED ✓
- "Run Verification" is disabled until PATCH_APPLIED ✓
- Before/after screenshots appear side-by-side after verification ✓
- Status badges reflect before=FAILED, after=PASSED correctly ✓

---

## Milestone 4 — UX Polish
**Goal:** Demo-ready, reliable, visually clean.

### Tasks

- [ ] **M4-S1** Status badge pulse animation while `REPRODUCING` or `VERIFYING`
- [ ] **M4-S2** Consistent typography and spacing across all pages
- [ ] **M4-S3** Error state cards for `REPRODUCTION_FAILED` and `VERIFICATION_FAILED` statuses
- [ ] **M4-S4** Responsive layout check (works at 1280px+ width)
- [ ] **M4-S5** "Demo Reset" button — calls `POST /api/demo/reset`, reloads the case
  - Show this button prominently for the judge demo
  - Resets case-001 to REPRODUCED state so demo can be repeated
- [ ] **M4-S6** Full end-to-end browser walkthrough — confirm all steps from Definition of Done work

### Acceptance Criteria

- Spinner/pulse visible during async operations ✓
- REPRODUCTION_FAILED shows a clear error card (not a blank section) ✓
- Demo Reset button resets case-001 and dashboard updates instantly ✓
- No layout breaks at standard laptop resolution ✓

---

## Key Contracts (do not change these without team sign-off)

### API Endpoints You Call

| Method | Route | When |
|--------|-------|------|
| `GET` | `/api/cases` | Cases list page load |
| `POST` | `/api/cases` | New case form submit |
| `GET` | `/api/cases/:id` | Case detail load + polling |
| `PATCH` | `/api/cases/:id` | Mark patch as applied |
| `POST` | `/api/cases/:id/reproduce` | Run Reproduction button |
| `POST` | `/api/cases/:id/verify` | Run Verification button |
| `GET` | `/api/cases/:id/evidence` | Evidence panel |
| `POST` | `/api/demo/reset` | Demo Reset button |

### Artifact URLs

```
http://localhost:3001/artifacts/<caseId>/before/screenshot.png
http://localhost:3001/artifacts/<caseId>/after/screenshot.png
http://localhost:3001/artifacts/<caseId>/before/trace.zip
http://localhost:3001/artifacts/<caseId>/after/trace.zip
```

### Status Badge Color Map

| Status | Color |
|--------|-------|
| `REPORTED` | Gray |
| `REPRODUCING` / `VERIFYING` | Blue (pulse) |
| `REPRODUCED` | Red |
| `REPRODUCTION_FAILED` / `VERIFICATION_FAILED` | Orange |
| `PATCH_PROPOSED` | Yellow |
| `PATCH_APPLIED` | Blue |
| `VERIFIED` | Green |

---

## Blocked / Waiting On

> Update this section as you work.

| Blocker | Waiting on | Status |
|---------|-----------|--------|
| Real API data | Abdullah Ijaz — M1 API foundation | ⬜ |
| Before screenshot served | Abdullah Ijaz — static file serving | ⬜ |
| Reproduce endpoint | Abdullah Ijaz — M2 runner | ⬜ |
| Verify endpoint | Abdullah Ijaz — M2 runner | ⬜ |
| Demo reset endpoint | Abdullah Ijaz — M4 | ⬜ |
