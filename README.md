# Bug-to-Proof

> Turn a bug report into reproducible, evidence-backed proof.

**Reported â†’ Reproduced â†’ Failed â†’ Patched â†’ Verified â†’ Proved**

---

## What is this?

Bug-to-Proof is a hackathon project that converts a plain-language software bug report into
a fully verifiable debugging workflow. The same Playwright test fails before the patch and
passes after it, with screenshots and traces preserved as proof.

---

## Team

| Name | Track | Branch |
|------|-------|--------|
| **Rida Zainab** | React Dashboard | `feature/dashboard` |
| **Abdullah Ijaz** | Node.js API + LLM | `feature/api` |
| **Sikander** | MiniShop + Playwright | `feature/playwright-minishop` |

---

## Prerequisites

- Node.js â‰¥ 18
- npm â‰¥ 9
- (For live Playwright runs) Chromium â€” installed automatically by `npx playwright install`

---

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd bug-to-proof

# 2. Install all dependencies (single command for the whole monorepo)
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env if you want to enable LLM features (optional)

# 4. Start all services
npm run dev
```

This starts:
- **Dashboard** at http://localhost:5173
- **API** at http://localhost:3001
- **MiniShop** at http://localhost:5174

---

## Services

### React Dashboard (`apps/dashboard`)

The main Bug-to-Proof UI. Shows cases, reproduction results, proposed patches, and
before/after evidence comparisons.

```bash
npm run dev:dashboard
```

### Node.js API (`services/api`)

REST API for case management, reproduction triggers, and verification.
Serves artifact files (screenshots, traces) as static files.

```bash
npm run dev:api
```

### MiniShop (`apps/minishop`)

A deliberately small React shopping app used as the demo target.
Contains a seeded cart total bug for demonstration.

```bash
npm run dev:minishop
```

---

## Running Tests

```bash
# Run the Playwright reproduction/verification test suite
npm run test:playwright
```

---

## Project Structure

```
bug-to-proof/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ dashboard/          # React + Vite dashboard (Rida Zainab)
â”‚   â””â”€â”€ minishop/           # React + Vite demo app with seeded bug (Sikander)
â”œâ”€â”€ services/
â”‚   â””â”€â”€ api/                # Node.js + Express API (Abdullah Ijaz)
â”œâ”€â”€ packages/
â”‚   â””â”€â”€ shared-types/       # Shared TypeScript types (frozen â€” all agree before changing)
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ playwright/         # Playwright reproduction & verification specs (Sikander)
â”œâ”€â”€ data/
â”‚   â””â”€â”€ cases/              # JSON case files (persisted state)
â”œâ”€â”€ artifacts/              # Playwright screenshots, traces, result JSON
â”œâ”€â”€ plans/                  # Implementation plan
â””â”€â”€ docs/                   # Demo script and documentation
```

---

## Demo Bug

**Case 001 â€” Cart total only reflects first item price**

When two products are added to MiniShop's cart, the total shows only the first item's
price instead of the sum of both.

| Step | Expected | Actual (buggy) |
|------|----------|----------------|
| Add Keyboard ($10) + Mouse Pad ($20) | $30.00 | $10.00 |

---

## LLM Integration (optional)

Three optional AI enhancements are available when an OpenAI-compatible API key is configured:

1. **Bug report structuring** â€” converts plain description into structured reproduction steps
2. **Patch summary** â€” explains what the diff changes and why
3. **Root cause explanation** â€” paragraph explaining the probable root cause

The system works fully without a key. Set `LLM_ENABLED=true` and `LLM_API_KEY=<your-key>`
in `.env` to enable.

---

## Architecture

```
React Dashboard (5173)
       â†“ HTTP
Node.js API (3001)
       â†“ JSON files        â†“ spawn
data/cases/*.json     Playwright Runner
                           â†“ HTTP
                      MiniShop (5174)
                           â†“ artifacts
                      artifacts/<caseId>/before|after/
```

---

<!-- Each team member: add your section notes to docs/section-<name>.md -->
<!-- Final README assembly happens during integration (Day 3) -->
