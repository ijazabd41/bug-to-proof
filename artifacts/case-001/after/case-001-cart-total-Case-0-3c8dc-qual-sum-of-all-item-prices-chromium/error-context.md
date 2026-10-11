# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-001-cart-total.spec.ts >> Case 001 — Cart total calculation >> cart total should equal sum of all item prices
- Location: tests\playwright\cases\case-001-cart-total.spec.ts:19:7

# Error details

```
Error: Cart total should be $30.00 after adding $10 + $20 items

expect(received).toBe(expected) // Object.is equality

Expected: "$30.00"
Received: "$10.00"
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
    - link "Cart (2)" [ref=e9] [cursor=pointer]:
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
        - generic [ref=e37]: $10.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - generic [ref=e40]: Mouse Pad
        - generic [ref=e41]: ×1
        - generic [ref=e42]: $20.00
        - button "Remove item" [ref=e43] [cursor=pointer]: ×
      - generic [ref=e44]:
        - generic [ref=e45]: Total
        - generic [ref=e46]: $10.00
      - button "Checkout" [ref=e47] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 001 — Cart total only reflects first item price
  6  |  *
  7  |  * Expected: Adding Keyboard ($10) + Mouse Pad ($20) should show total $30.00
  8  |  * Actual (buggy): Total shows $10.00 — only first item's price
  9  |  *
  10 |  * This test FAILS on the buggy MiniShop (before patch).
  11 |  * This test PASSES on the fixed MiniShop (after patch).
  12 |  *
  13 |  * Phase is controlled by PHASE env var (set by API runner):
  14 |  *   PHASE=before → test expected to fail
  15 |  *   PHASE=after  → test expected to pass
  16 |  */
  17 | 
  18 | test.describe("Case 001 — Cart total calculation", () => {
  19 |   test("cart total should equal sum of all item prices", async ({ page }) => {
  20 |     const shop = new MiniShopPage(page);
  21 | 
  22 |     // Navigate to MiniShop
  23 |     await shop.navigate();
  24 | 
  25 |     // Add Keyboard ($10.00)
  26 |     await shop.addToCart(1);
  27 | 
  28 |     // Add Mouse Pad ($20.00)
  29 |     await shop.addToCart(2);
  30 | 
  31 |     // Take screenshot (saved to artifacts/<caseId>/<phase>/screenshot.png)
  32 |     await shop.takeScreenshot("screenshot");
  33 | 
  34 |     // Assert: cart total must be $30.00
  35 |     const total = await shop.getCartTotal();
> 36 |     expect(total, "Cart total should be $30.00 after adding $10 + $20 items").toBe("$30.00");
     |                                                                               ^ Error: Cart total should be $30.00 after adding $10 + $20 items
  37 |   });
  38 | 
  39 |   test("cart total should update when items are added incrementally", async ({ page }) => {
  40 |     const shop = new MiniShopPage(page);
  41 |     await shop.navigate();
  42 | 
  43 |     // Add single item first
  44 |     await shop.addToCart(1);
  45 |     let total = await shop.getCartTotal();
  46 |     expect(total, "After adding Keyboard only, total should be $10.00").toBe("$10.00");
  47 | 
  48 |     // Add second item
  49 |     await shop.addToCart(2);
  50 |     total = await shop.getCartTotal();
  51 |     expect(total, "After adding Mouse Pad, total should be $30.00").toBe("$30.00");
  52 |   });
  53 | });
  54 | 
```