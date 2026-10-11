# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-008-tiered-shipping.spec.ts >> Case 008 — Coordinated tiered shipping calculation and display >> shipping fee should be $0.00 for orders of $50.00 or more
- Location: tests\playwright\cases\case-008-tiered-shipping.spec.ts:24:7

# Error details

```
Error: BTP_ASSERTION: Shipping fee should be $0.00 (free shipping) on $50.00 total

expect(received).toBe(expected) // Object.is equality

Expected: "$0.00"
Received: "$5.00"
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
    - link "Cart (5)" [ref=e9] [cursor=pointer]:
      - /url: /cart
  - generic [ref=e10]:
    - generic [ref=e12]:
      - heading "Products" [level=2] [ref=e13]
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Keyboard
          - generic [ref=e17]: $10.00
          - button "Add to Cart" [active] [ref=e18] [cursor=pointer]
        - generic [ref=e19]:
          - generic [ref=e20]: Mouse Pad
          - generic [ref=e21]: $20.00
          - button "Add to Cart" [ref=e22] [cursor=pointer]
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
        - generic [ref=e36]: ×5
        - generic [ref=e37]: $50.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - textbox "Promo code" [ref=e40]
        - button "Apply" [ref=e41] [cursor=pointer]
      - generic [ref=e42]:
        - generic [ref=e43]: Shipping
        - generic [ref=e44]: $5.00
      - generic [ref=e45]:
        - generic [ref=e46]: Total
        - generic [ref=e47]: $50.00
      - button "Checkout" [ref=e48] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 008 — Coordinated multi-file defect in tiered shipping calculation and display
  6  |  *
  7  |  * Expected: Adding 5 Keyboards ($10 x 5 = $50.00) meets the $50 free shipping threshold.
  8  |  * Shipping fee should display "$0.00".
  9  |  * Actual (buggy): Shipping displays "$5.00" because cartStore calculates shipping > 50 strictly
  10 |  * and Cart component hardcodes the fee display.
  11 |  */
  12 | 
  13 | async function assertShipping(actual: string, expected: string, message: string) {
  14 |   if (actual !== expected) {
  15 |     await test.info().attach("btp-assertion", {
  16 |       body: Buffer.from(JSON.stringify({ actual, expected })),
  17 |       contentType: "application/json",
  18 |     });
  19 |   }
> 20 |   expect(actual, message).toBe(expected);
     |                           ^ Error: BTP_ASSERTION: Shipping fee should be $0.00 (free shipping) on $50.00 total
  21 | }
  22 | 
  23 | test.describe("Case 008 — Coordinated tiered shipping calculation and display", () => {
  24 |   test("shipping fee should be $0.00 for orders of $50.00 or more", async ({ page }) => {
  25 |     const shop = new MiniShopPage(page);
  26 |     await shop.navigate();
  27 | 
  28 |     // Add Keyboard 5 times ($10.00 x 5 = $50.00)
  29 |     for (let i = 0; i < 5; i++) {
  30 |       await shop.addToCart(1);
  31 |     }
  32 | 
  33 |     await shop.takeScreenshot("screenshot");
  34 | 
  35 |     const shippingEl = page.getByTestId("shipping-fee");
  36 |     await shippingEl.waitFor({ state: "visible" });
  37 |     const shippingFee = (await shippingEl.innerText()).trim();
  38 | 
  39 |     await assertShipping(
  40 |       shippingFee,
  41 |       "$0.00",
  42 |       "BTP_ASSERTION: Shipping fee should be $0.00 (free shipping) on $50.00 total"
  43 |     );
  44 |   });
  45 | });
  46 | 
```