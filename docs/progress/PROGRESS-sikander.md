# Sikander — Progress Tracker
### Track: MiniShop + Playwright · Branch: `feature/playwright-minishop`

> Own: `apps/minishop/`, `tests/playwright/`
> Do NOT modify `apps/dashboard/` or `services/api/src/routes/`.
> You may coordinate with Abdullah Ijaz on artifact paths and `case-001.json` seeding.

---

## Overall Status

| Milestone | Status |
|-----------|--------|
| M0 — Contracts (shared) | ✅ Complete |
| M1 — MiniShop Foundation | ⬜ Pending |
| M2 — Playwright Spec & Evidence | ⬜ Pending |
| M3 — Fix Bug + After Run | ⬜ Pending |
| M4 — Playwright Polish & Demo Script | ⬜ Pending |

---

## Milestone 0 — Contracts ✅ COMPLETE (done by Abdullah Ijaz)

Nothing to do — contracts already committed to `main`.
Pull `main` into your branch before starting M1.

```bash
git checkout main
git pull
git checkout -b feature/playwright-minishop
```

### Key things to know from the contracts

**MiniShop `data-testid` values** (you must add these to every element):

| Element | `data-testid` value |
|---------|---------------------|
| Add to cart button for product N | `add-to-cart-{N}` |
| Cart total display | `cart-total` |
| Cart item row for product N | `cart-item-{N}` |
| Cart item quantity for product N | `cart-item-quantity-{N}` |
| Checkout button | `checkout-button` |

These are also exported as `TEST_IDS` constants from `@bug-to-proof/shared-types` — import them in your Playwright helpers.

**Products to hard-code:**

| ID | Name | Price |
|----|------|-------|
| 1 | Mechanical Keyboard | $10.00 |
| 2 | Mouse Pad | $20.00 |
| 3 | USB Hub | $15.00 |
| 4 | Webcam | $50.00 |

**The demo test scenario:** Add product 1 ($10) + product 2 ($20) → assert cart total = `$30.00`

---

## Milestone 1 — MiniShop Foundation
**Goal:** MiniShop running on port 5174 with the seeded bug visually obvious.

### Tasks

- [ ] **M1-R1** Scaffold `apps/minishop/` with `npm create vite@latest` (React + TypeScript)
- [ ] **M1-R2** Configure Vite: port `5174` in `vite.config.ts`
- [ ] **M1-R3** Create `apps/minishop/tsconfig.json` extending `../../tsconfig.base.json`
- [ ] **M1-R4** Create `apps/minishop/src/types/index.ts` with `Product` and `CartItem` interfaces
- [ ] **M1-R5** Create `apps/minishop/src/store/cartStore.ts` with the **intentional bug**:

  ```typescript
  // ⚠️  INTENTIONAL BUG — do not fix until demo/patched-minishop branch
  // Total only reads the first item's price regardless of what else is in the cart
  const total = items.length > 0 ? items[0].price * items[0].quantity : 0;
  ```

- [ ] **M1-R6** Create hard-coded product catalog in `apps/minishop/src/data/products.ts`
- [ ] **M1-R7** Create `apps/minishop/src/components/ProductCard.tsx`:
  - Shows name, price, "Add to Cart" button
  - Button has `data-testid={TEST_IDS.addToCart(product.id)}`
- [ ] **M1-R8** Create `apps/minishop/src/pages/ShopPage.tsx`:
  - Grid of all 4 products using `ProductCard`
  - Navigation link to cart
- [ ] **M1-R9** Create `apps/minishop/src/components/Cart.tsx`:
  - Renders list of cart items with name, price, quantity
  - Renders total with `data-testid="cart-total"` — format as `$XX.XX`
  - Each item row has `data-testid={TEST_IDS.cartItem(item.productId)}`
  - Quantity has `data-testid={TEST_IDS.cartItemQuantity(item.productId)}`
  - Checkout button has `data-testid="checkout-button"`
- [ ] **M1-R10** Create `apps/minishop/src/pages/CartPage.tsx` using `Cart` component
- [ ] **M1-R11** Create `apps/minishop/src/App.tsx` with React Router:
  - `/` → `ShopPage`
  - `/cart` → `CartPage`
- [ ] **M1-R12** Confirm `npm run dev:minishop` starts on port 5174
- [ ] **M1-R13** Manually verify the bug: add Keyboard ($10) + Mouse Pad ($20) → total shows **$10.00** (not $30.00)

### Files to Create

| File | Notes |
|------|-------|
| `apps/minishop/package.json` | Workspace package |
| `apps/minishop/vite.config.ts` | Port 5174 |
| `apps/minishop/tsconfig.json` | Extends base |
| `apps/minishop/index.html` | Vite entry |
| `apps/minishop/src/main.tsx` | React root |
| `apps/minishop/src/App.tsx` | Router |
| `apps/minishop/src/types/index.ts` | Product, CartItem types |
| `apps/minishop/src/data/products.ts` | Hard-coded catalog |
| `apps/minishop/src/store/cartStore.ts` | Cart state with bug |
| `apps/minishop/src/components/ProductCard.tsx` | Product tile |
| `apps/minishop/src/components/Cart.tsx` | Cart with total |
| `apps/minishop/src/pages/ShopPage.tsx` | Shop page |
| `apps/minishop/src/pages/CartPage.tsx` | Cart page |

### Acceptance Criteria

- `npm run dev:minishop` starts on port 5174 ✓
- Shop page shows 4 products with "Add to Cart" buttons ✓
- Adding Keyboard + Mouse Pad shows total as **$10.00** (bug present) ✓
- All `data-testid` attributes are present on correct elements ✓
- No TypeScript errors ✓

---

## Milestone 2 — Playwright Spec & Evidence
**Goal:** Playwright spec runs and FAILS against buggy MiniShop. Before-run artifacts committed.

### Tasks

- [ ] **M2-R1** Scaffold `tests/playwright/` — init workspace `package.json`, install `@playwright/test`
- [ ] **M2-R2** Run `npx playwright install chromium` to install browser
- [ ] **M2-R3** Create `tests/playwright/playwright.config.ts`:
  - `baseURL`: `http://localhost:5174`
  - `trace`: `"on"`
  - `screenshot`: `"on"`
  - `outputDir`: use `process.env.ARTIFACTS_DIR ?? "../../artifacts"` + `/${process.env.CASE_ID ?? "unknown"}/${process.env.PHASE ?? "before"}`
  - `timeout`: `process.env.PLAYWRIGHT_TIMEOUT ? parseInt(process.env.PLAYWRIGHT_TIMEOUT) : 30000`
- [ ] **M2-R4** Create `tests/playwright/helpers/minishop.ts` — page-object helpers:
  - `addToCart(page, productId)` — clicks `data-testid="add-to-cart-{id}"`
  - `goToCart(page)` — navigates to `/cart`
  - `getCartTotal(page)` — returns text of `data-testid="cart-total"`
- [ ] **M2-R5** Create `tests/playwright/cases/case-001-cart-total.spec.ts`:

  ```typescript
  test("Cart total equals sum of all item prices", async ({ page }) => {
    await page.goto("/");
    await addToCart(page, 1);   // Keyboard $10
    await addToCart(page, 2);   // Mouse Pad $20
    await goToCart(page);
    await page.screenshot({ path: `...` });
    await expect(page.getByTestId("cart-total")).toHaveText("$30.00");
  });
  ```

- [ ] **M2-R6** Run `npm run test:playwright` against buggy MiniShop — confirm test **FAILS**:
  - Error should say: expected `$30.00`, received `$10.00`
- [ ] **M2-R7** Locate generated trace ZIP and screenshot from the Playwright output directory
- [ ] **M2-R8** Copy artifacts to `artifacts/case-001/before/`:
  - `artifacts/case-001/before/screenshot.png`
  - `artifacts/case-001/before/trace.zip`
  - `artifacts/case-001/before/result.json` (manually create from test output)
- [ ] **M2-R9** Commit these artifacts to `feature/playwright-minishop` branch
- [ ] **M2-R10** Notify Abdullah Ijaz that before artifacts are in place so he can finalize `case-001.json`

### `result.json` format for before run

```json
{
  "passed": false,
  "expected": "Cart total displays $30.00",
  "actual": "Cart total displays $10.00",
  "durationMs": 4000,
  "runAt": "2025-01-01T10:30:00.000Z"
}
```

### Files to Create

| File | Notes |
|------|-------|
| `tests/playwright/package.json` | Workspace package |
| `tests/playwright/playwright.config.ts` | Config with env-driven output dir |
| `tests/playwright/cases/case-001-cart-total.spec.ts` | Primary reproduction spec |
| `tests/playwright/helpers/minishop.ts` | Page-object helpers |
| `artifacts/case-001/before/screenshot.png` | **Committed** — shows $10.00 |
| `artifacts/case-001/before/trace.zip` | **Committed** |
| `artifacts/case-001/before/result.json` | **Committed** |

### Acceptance Criteria

- `npm run test:playwright` runs and **FAILS** with clear message ✓
- Error clearly shows `Expected: "$30.00"`, `Received: "$10.00"` (or equivalent) ✓
- Screenshot shows the cart total displaying the wrong amount ✓
- `artifacts/case-001/before/` has all three files committed ✓

---

## Milestone 3 — Fix the Bug + After Run
**Goal:** Same test PASSES on patched MiniShop. After artifacts committed.

### Tasks

- [ ] **M3-R1** Create branch `demo/patched-minishop` from your feature branch
- [ ] **M3-R2** Apply the fix to `apps/minishop/src/store/cartStore.ts`:

  ```typescript
  // CORRECT — sum all items
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  ```

- [ ] **M3-R3** Start MiniShop on `demo/patched-minishop` branch and confirm the cart shows **$30.00**
- [ ] **M3-R4** Run `npm run test:playwright` (same spec, `PHASE=after`) — confirm test **PASSES**
- [ ] **M3-R5** Locate after-run screenshot and trace from Playwright output
- [ ] **M3-R6** Copy to `artifacts/case-001/after/`:
  - `artifacts/case-001/after/screenshot.png`
  - `artifacts/case-001/after/trace.zip`
  - `artifacts/case-001/after/result.json`
- [ ] **M3-R7** Commit after artifacts to branch
- [ ] **M3-R8** Coordinate with Abdullah Ijaz — share the `result.json` values so he can finalize `verification.afterRun` in `case-001.json`

### `result.json` format for after run

```json
{
  "passed": true,
  "expected": "Cart total displays $30.00",
  "actual": "Cart total displays $30.00",
  "durationMs": 3800,
  "runAt": "2025-01-01T12:00:00.000Z"
}
```

### Files to Create / Modify

| File | Change |
|------|--------|
| `apps/minishop/src/store/cartStore.ts` | Fixed total calculation (on `demo/patched-minishop` branch only) |
| `artifacts/case-001/after/screenshot.png` | **Committed** — shows $30.00 |
| `artifacts/case-001/after/trace.zip` | **Committed** |
| `artifacts/case-001/after/result.json` | **Committed** |

### Acceptance Criteria

- `demo/patched-minishop` branch MiniShop shows cart total **$30.00** ✓
- Same `case-001-cart-total.spec.ts` **PASSES** on patched MiniShop ✓
- `artifacts/case-001/after/` has all three files committed ✓
- Before and after artifacts are both present in the repo ✓

---

## Milestone 4 — Playwright Polish & Demo Script
**Goal:** Spec is stable and deterministic. Demo script written. Full live workflow verified.

### Tasks

- [ ] **M4-R1** Review `case-001-cart-total.spec.ts` for flakiness:
  - Use `waitForSelector` / `expect().toBeVisible()` rather than hard waits
  - Add explicit navigation wait after clicking "Add to Cart"
  - Confirm spec passes reliably 3 times in a row on patched MiniShop
- [ ] **M4-R2** Verify all artifacts (`before/` and `after/`) are served correctly by the API:
  - `GET http://localhost:3001/artifacts/case-001/before/screenshot.png` → 200
  - `GET http://localhost:3001/artifacts/case-001/after/screenshot.png` → 200
- [ ] **M4-R3** Run the full live end-to-end workflow via the dashboard:
  1. Click "Run Reproduction" on case-001
  2. Confirm status → REPRODUCING → REPRODUCED
  3. Confirm failure screenshot appears
  4. Apply fix, click "Run Verification"
  5. Confirm status → VERIFYING → VERIFIED
  6. Confirm after screenshot appears
- [ ] **M4-R4** Write `docs/demo-script.md` — the exact 2-3 minute judge demo script

### Acceptance Criteria

- Playwright spec is deterministic (no flaky timing issues) ✓
- Both before and after screenshots serve at correct URLs ✓
- Full live workflow succeeds in a single uninterrupted run ✓
- `docs/demo-script.md` written and reviewed ✓

---

## Key Contracts You Depend On

### From Abdullah Ijaz (API)

| Contract | Value |
|----------|-------|
| Artifact static base URL | `http://localhost:3001/artifacts/` |
| Reproduce endpoint | `POST /api/cases/:id/reproduce` |
| Verify endpoint | `POST /api/cases/:id/verify` |
| MiniShop health check in runner | HEAD `http://localhost:5174` |
| `CASE_ID` env var passed to Playwright | e.g. `case-001` |
| `PHASE` env var passed to Playwright | `"before"` or `"after"` |

### From Shared Types (`@bug-to-proof/shared-types`)

```typescript
import { TEST_IDS } from "@bug-to-proof/shared-types";

// Use in your spec and helpers:
TEST_IDS.addToCart(1)         // "add-to-cart-1"
TEST_IDS.cartTotal            // "cart-total"
TEST_IDS.cartItem(1)          // "cart-item-1"
TEST_IDS.cartItemQuantity(1)  // "cart-item-quantity-1"
TEST_IDS.checkoutButton       // "checkout-button"
```

---

## Blocked / Waiting On

> Update this section as you work.

| Blocker | Waiting on | Status |
|---------|-----------|--------|
| Artifact serving (to verify URLs work) | Abdullah Ijaz — M1 static file serving | ⬜ |
| `PHASE` + `CASE_ID` env vars confirmed | Abdullah Ijaz — M2 runner | ⬜ |
| `demo/patched-minishop` branch strategy | Team agreement (M3) | ⬜ |
