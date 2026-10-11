# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-007-promo-discount.spec.ts >> Case 007 — Async promo code race condition >> concurrent item addition during async promo validation is preserved
- Location: tests\playwright\cases\case-007-promo-discount.spec.ts:26:7

# Error details

```
Error: BTP_ASSERTION: Cart total should be $24.00 reflecting both items after async promo discount

expect(received).toBe(expected) // Object.is equality

Expected: "$24.00"
Received: "$8.00"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - heading [level=1] [ref=e6]:
        - link "🛒 MiniShop" [ref=e7] [cursor=pointer]:
          - /url: /
      - paragraph [ref=e8]: Demo store for Bug-to-Proof
    - link "Cart (1)" [ref=e9] [cursor=pointer]:
      - /url: /cart
  - generic [ref=e10]:
    - generic [ref=e12]:
      - heading "Products" [level=2] [ref=e13]
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Keyboard
          - generic [ref=e17]: $10.00
          - button "Add to Cart" [ref=e18] [cursor=pointer]
        - generic [ref=e19]:
          - generic [ref=e20]: Mouse Pad
          - generic [ref=e21]: $20.00
          - button "Add to Cart" [active] [ref=e22] [cursor=pointer]
        - generic [ref=e23]:
          - generic [ref=e24]: USB Hub
          - generic [ref=e25]: $15.00
          - button "Add to Cart" [ref=e26] [cursor=pointer]
        - generic [ref=e27]:
          - generic [ref=e28]: Webcam
          - generic [ref=e29]: $35.00
          - button "Add to Cart" [ref=e30] [cursor=pointer]
    - generic [ref=e32]:
      - heading "Cart" [level=2] [ref=e33]
      - generic [ref=e34]:
        - generic [ref=e35]: Keyboard
        - generic [ref=e36]: ×1
        - generic [ref=e37]: $8.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - textbox "Promo code" [ref=e40]: SAVE20
        - button "Apply" [ref=e41] [cursor=pointer]
      - paragraph [ref=e42]: Promo code applied!
      - generic [ref=e43]:
        - generic [ref=e44]: Shipping
        - generic [ref=e45]: $5.00
      - generic [ref=e46]:
        - generic [ref=e47]: Total
        - generic [ref=e48]: $8.00
      - button "Checkout" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 007 — Async promo code application race condition drops concurrent cart updates
  6  |  *
  7  |  * Expected: Adding Keyboard ($10.00), applying promo code "SAVE20" (80ms async validation),
  8  |  * and concurrently adding Mouse Pad ($20.00) while validation is in flight should preserve both items.
  9  |  * Subtotal is $30.00, discounted 20% to $24.00.
  10 |  *
  11 |  * Actual (buggy): applyPromoCode captures a stale pre-await snapshot of items and overwrites
  12 |  * state upon completion, dropping the Mouse Pad added concurrently. Total displays $8.00.
  13 |  */
  14 | 
  15 | async function assertTotal(actual: string, expected: string, message: string) {
  16 |   if (actual !== expected) {
  17 |     await test.info().attach("btp-assertion", {
  18 |       body: Buffer.from(JSON.stringify({ actual, expected })),
  19 |       contentType: "application/json",
  20 |     });
  21 |   }
> 22 |   expect(actual, message).toBe(expected);
     |                           ^ Error: BTP_ASSERTION: Cart total should be $24.00 reflecting both items after async promo discount
  23 | }
  24 | 
  25 | test.describe("Case 007 — Async promo code race condition", () => {
  26 |   test("concurrent item addition during async promo validation is preserved", async ({ page }) => {
  27 |     const shop = new MiniShopPage(page);
  28 |     await shop.navigate();
  29 | 
  30 |     // 1. Add Keyboard ($10.00)
  31 |     await shop.addToCart(1);
  32 | 
  33 |     // 2. Start async promo code application
  34 |     const promoInput = page.getByTestId("promo-input");
  35 |     await promoInput.fill("SAVE20");
  36 |     await page.getByTestId("apply-promo-button").click();
  37 | 
  38 |     // 3. Concurrently add Mouse Pad ($20.00) while promo validation is in flight
  39 |     await shop.addToCart(2);
  40 | 
  41 |     // 4. Wait for promo applied message
  42 |     await page.getByText("Promo code applied!").waitFor({ state: "visible" });
  43 | 
  44 |     await shop.takeScreenshot("screenshot");
  45 | 
  46 |     const total = await shop.getCartTotal();
  47 |     await assertTotal(
  48 |       total,
  49 |       "$24.00",
  50 |       "BTP_ASSERTION: Cart total should be $24.00 reflecting both items after async promo discount"
  51 |     );
  52 |   });
  53 | });
  54 | 
```