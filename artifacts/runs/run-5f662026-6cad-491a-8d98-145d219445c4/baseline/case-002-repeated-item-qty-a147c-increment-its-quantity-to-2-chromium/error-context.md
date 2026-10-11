# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-002-repeated-item-qty.spec.ts >> Case 002 — Repeated item quantity increment >> adding an item twice should increment its quantity to 2
- Location: tests\playwright\cases\case-002-repeated-item-qty.spec.ts:22:7

# Error details

```
Error: BTP_ASSERTION: Item quantity should be ×2 after adding Keyboard twice

expect(received).toBe(expected) // Object.is equality

Expected: "×2"
Received: "×1"
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
        - generic [ref=e36]: ×1
        - generic [ref=e37]: $10.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - generic [ref=e40]: Total
        - generic [ref=e41]: $10.00
      - button "Checkout" [ref=e42] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 002 — Adding an existing item does not increment its quantity
  6  |  *
  7  |  * Expected: Adding Keyboard ($10) twice should show quantity "×2" in the cart.
  8  |  * Actual (buggy): Quantity resets to / remains "×1".
  9  |  */
  10 | 
  11 | async function assertQuantity(actual: string, expected: string, message: string) {
  12 |   if (actual !== expected) {
  13 |     await test.info().attach("btp-assertion", {
  14 |       body: Buffer.from(JSON.stringify({ actual, expected })),
  15 |       contentType: "application/json",
  16 |     });
  17 |   }
> 18 |   expect(actual, message).toBe(expected);
     |                           ^ Error: BTP_ASSERTION: Item quantity should be ×2 after adding Keyboard twice
  19 | }
  20 | 
  21 | test.describe("Case 002 — Repeated item quantity increment", () => {
  22 |   test("adding an item twice should increment its quantity to 2", async ({ page }) => {
  23 |     const shop = new MiniShopPage(page);
  24 | 
  25 |     await shop.navigate();
  26 | 
  27 |     // Add Keyboard first time
  28 |     await shop.addToCart(1);
  29 | 
  30 |     // Add Keyboard second time
  31 |     await shop.addToCart(1);
  32 | 
  33 |     await shop.takeScreenshot("screenshot");
  34 | 
  35 |     const qty = await shop.getItemQuantity(1);
  36 |     await assertQuantity(
  37 |       qty,
  38 |       "×2",
  39 |       "BTP_ASSERTION: Item quantity should be ×2 after adding Keyboard twice"
  40 |     );
  41 |   });
  42 | });
  43 | 
```