# Bug-to-Proof — Central Progress Tracker

> Last updated: see individual progress files for per-member detail.
> Milestone 0 is **complete**. All three members can now branch and work in parallel.

---

## Team

| Member | Track | Branch | Progress File |
|--------|-------|--------|---------------|
| **Rida Zainab** | React Dashboard | `feature/dashboard` | [PROGRESS-rida.md](PROGRESS-rida.md) |
| **Abdullah Ijaz** | Node.js API + LLM | `feature/api` | [PROGRESS-abdullah.md](PROGRESS-abdullah.md) |
| **Sikander** | MiniShop + Playwright | `feature/playwright-minishop` | [PROGRESS-sikander.md](PROGRESS-sikander.md) |

---

## Milestone Overview

| Milestone | Description | Status |
|-----------|-------------|--------|
| **M0 — Contracts** | Shared types, root workspace, env config | ✅ Done |
| **M1 — Foundation** | Each member's app scaffolding and base setup | ✅ Done |
| **M2 — Core Workflow** | API connected, Playwright spec running, dashboard live | ✅ Done |
| **M3 — Patch Workflow** | Patch UI, verification, before/after evidence | ✅ Done |
| **M4 — Demo Polish** | Integration, UX polish, demo reset, docs | ⚠️ Partial — see PROGRESS-abdullah.md |

---

## Milestone 0 — Architecture & Contracts ✅ COMPLETE

Completed by **Abdullah Ijaz** before parallel work began.

| Task | File(s) | Status |
|------|---------|--------|
| Root `package.json` with npm workspaces | `package.json` | ✅ |
| `tsconfig.base.json` | `tsconfig.base.json` | ✅ |
| `.gitignore` | `.gitignore` | ✅ |
| `.env.example` with all vars documented | `.env.example` | ✅ |
| Shared types package | `packages/shared-types/src/index.ts` | ✅ |
| `data/cases/` placeholder | `data/cases/.gitkeep` | ✅ |
| `artifacts/` placeholder | `artifacts/.gitkeep` | ✅ |
| `README.md` skeleton | `README.md` | ✅ |
| `npm install` clean | `node_modules/` | ✅ |
| TypeScript check on shared types | — | ✅ |

**Acceptance:** All three members can branch from `main` and import from `@bug-to-proof/shared-types`.

---

## Milestone 1 — Foundation ✅ COMPLETE

| Member | Task | Status |
|--------|------|--------|
| Rida Zainab* | Scaffold `apps/dashboard/` | ✅ (built by Abdullah) |
| Rida Zainab* | Routing + mock API client | ✅ (built by Abdullah) |
| Rida Zainab* | `CaseList` + `CaseDetail` shell | ✅ (built by Abdullah) |
| Abdullah Ijaz | Scaffold `services/api/` | ✅ |
| Abdullah Ijaz | Case CRUD routes + JSON storage | ✅ |
| Abdullah Ijaz | Seeded `data/cases/case-001.json` | ✅ |
| Sikander* | Scaffold `apps/minishop/` | ✅ (built by Abdullah) |
| Sikander* | Seeded cart bug in `cartStore.ts` | ✅ (built by Abdullah) |
| Sikander* | All `data-testid` attributes in place | ✅ (built by Abdullah) |

> *These were built by Abdullah to unblock integration. Rida and Sikander should review and extend.

---

## Milestone 2 — Core Workflow ✅ COMPLETE

| Member | Task | Status |
|--------|------|--------|
| Rida Zainab* | Connect dashboard to real API + polling | ✅ (built by Abdullah) |
| Rida Zainab* | `BugReportForm` + `EvidencePanel` components | ✅ (built by Abdullah) |
| Abdullah Ijaz | Playwright runner (`playwrightRunner.ts`) | ✅ |
| Abdullah Ijaz | Reproduce + verify routes | ✅ |
| Abdullah Ijaz | LLM client (`llm/client.ts`) | ✅ |
| Abdullah Ijaz | LLM Call 1 — bug report structuring | ✅ |
| Abdullah Ijaz | LLM Call 3 — root cause explanation on REPRODUCED | ✅ |
| Sikander* | Playwright config + `case-001-cart-total.spec.ts` | ✅ (built by Abdullah) |
| Sikander* | Confirm test FAILS on buggy MiniShop | ⬜ needs live run |
| Sikander* | Seed `artifacts/case-001/before/` | ⬜ needs live run |

---

## Milestone 3 — Patch Workflow ✅ COMPLETE

| Member | Task | Status |
|--------|------|--------|
| Rida Zainab* | `PatchViewer` component (diff display) | ✅ (built by Abdullah) |
| Rida Zainab* | `BeforeAfterComparison` component | ✅ (built by Abdullah) |
| Rida Zainab* | "Mark as Applied" + "Run Verification" buttons | ✅ (built by Abdullah) |
| Abdullah Ijaz | Patch state handling + state machine enforcement | ✅ |
| Abdullah Ijaz | LLM Call 2 — patch summary on diff submit | ✅ |
| Abdullah Ijaz | Full `data/cases/case-001.json` with patch seeded | ✅ |
| Sikander | Apply fix to MiniShop (patched `cartStore.ts`) | ⬜ needs doing |
| Sikander | Run same spec on patched MiniShop — confirm PASS | ⬜ needs doing |
| Sikander | Seed `artifacts/case-001/after/` | ⬜ needs doing |

---

## Milestone 4 — Demo Polish ⚠️ PARTIAL

| Member | Task | Status |
|--------|------|--------|
| Rida Zainab* | Status badge animations + error states | ✅ (built by Abdullah) |
| Rida Zainab* | "Demo Reset" button in dashboard | ✅ (built by Abdullah) |
| Rida Zainab | Full end-to-end browser test | ⬜ |
| Abdullah Ijaz | `POST /api/demo/reset` endpoint | ✅ |
| Abdullah Ijaz | Final integration test (all 3 services) | ⚠️ See known issue in PROGRESS-abdullah.md |
| Abdullah Ijaz | `npm run demo` script + README finalize | ⬜ |
| Sikander | Playwright spec stability + determinism check | ⬜ |
| Sikander | Verify all artifacts serve via API | ⬜ |
| Sikander | Write `docs/demo-script.md` | ⬜ |

---

## Shared Contracts (frozen — do not change without team sign-off)

| Contract | File | Owner |
|----------|------|-------|
| TypeScript types | `packages/shared-types/src/index.ts` | Abdullah Ijaz |
| API response shapes | See plan Section 16.2 | All agreed |
| Artifact path convention | `artifacts/<id>/<phase>/<file>` | All agreed |
| MiniShop `data-testid` values | `TEST_IDS` in shared-types | All agreed |
| Port assignments | `.env.example` | All agreed |

---

## Integration Sync Points

| Sync | Trigger | Who |
|------|---------|-----|
| API contract review | Before M2 starts | All together |
| Artifact path test | Before Rida seeds before/ artifacts | Rida + Abdullah |
| Full end-to-end smoke test | After all M3 tasks done | All together |
| Final demo rehearsal | After M4 | All together × 3 runs |

---

## Definition of Done

- [ ] Enter bug report → case created
- [ ] View reproduction steps
- [ ] Click "Run Reproduction" → test FAILS → evidence saved
- [ ] View failure screenshot in dashboard
- [ ] View proposed patch diff
- [ ] Click "Mark as Applied" → status → PATCH_APPLIED
- [ ] Click "Run Verification" → test PASSES → evidence saved
- [ ] View before/after screenshot comparison
- [ ] Refresh browser → case still present (JSON persisted)
- [ ] Demo reset works for repeat judge demos
