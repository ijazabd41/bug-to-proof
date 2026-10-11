# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-005-cart-total-quantities.spec.ts >> Case 005 — Cart total quantity multiplication >> cart total should multiply price by quantity for repeated items
- Location: tests\playwright\cases\case-005-cart-total-quantities.spec.ts:22:7

# Error details

```
Error: BTP_ASSERTION: Cart total should be $40.00 after adding $10×2 + $20×1

expect(received).toBe(expected) // Object.is equality

Expected: "$40.00"
Received: "$30.00"
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
    - link "Cart (3)" [ref=e9] [cursor=pointer]:
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
        - generic [ref=e36]: ×2
        - generic [ref=e37]: $20.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - generic [ref=e40]: Mouse Pad
        - generic [ref=e41]: ×1
        - generic [ref=e42]: $20.00
        - button "Remove item" [ref=e43] [cursor=pointer]: ×
      - generic [ref=e44]:
        - generic [ref=e45]: Total
        - generic [ref=e46]: $30.00
      - button "Checkout" [ref=e47] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 005 — Cart total calculation ignores item quantities
  6  |  *
  7  |  * Expected: Adding Keyboard ($10) twice + Mouse Pad ($20) once should equal $40.00
  8  |  * Actual (buggy): Total sums item.price ($10 + $20 = $30.00) without multiplying by quantity.
  9  |  */
  10 | 
  11 | async function assertTotal(actual: string, expected: string, message: string) {
  12 |   if (actual !== expected) {
  13 |     await test.info().attach("btp-assertion", {
  14 |       body: Buffer.from(JSON.stringify({ actual, expected })),
  15 |       contentType: "application/json",
  16 |     });
  17 |   }
> 18 |   expect(actual, message).toBe(expected);
     |                           ^ Error: BTP_ASSERTION: Cart total should be $40.00 after adding $10×2 + $20×1
  19 | }
  20 | 
  21 | test.describe("Case 005 — Cart total quantity multiplication", () => {
  22 |   test("cart total should multiply price by quantity for repeated items", async ({ page }) => {
  23 |     const shop = new MiniShopPage(page);
  24 | 
  25 |     await shop.navigate();
  26 | 
  27 |     // Add Keyboard ($10.00) twice -> $20.00
  28 |     await shop.addToCart(1);
  29 |     await shop.addToCart(1);
  30 | 
  31 |     // Add Mouse Pad ($20.00) once -> $20.00
  32 |     await shop.addToCart(2);
  33 | 
  34 |     await shop.takeScreenshot("screenshot");
  35 | 
  36 |     // Total must be $40.00
  37 |     const total = await shop.getCartTotal();
  38 |     await assertTotal(
  39 |       total,
  40 |       "$40.00",
  41 |       "BTP_ASSERTION: Cart total should be $40.00 after adding $10×2 + $20×1"
  42 |     );
  43 |   });
  44 | });
  45 | 
```