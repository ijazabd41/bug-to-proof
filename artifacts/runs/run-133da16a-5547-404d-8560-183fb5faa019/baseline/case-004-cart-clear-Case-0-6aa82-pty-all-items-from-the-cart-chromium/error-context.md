# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-004-cart-clear.spec.ts >> Case 004 — Cart clear on checkout >> checking out should empty all items from the cart
- Location: tests\playwright\cases\case-004-cart-clear.spec.ts:23:7

# Error details

```
Error: BTP_ASSERTION: Cart should display 'Your cart is empty.' after checkout

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
        - generic [ref=e35]: Mouse Pad
        - generic [ref=e36]: ×1
        - generic [ref=e37]: $20.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - generic [ref=e40]: Total
        - generic [ref=e41]: $20.00
      - button "Checkout" [active] [ref=e42] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 004 — Clear cart leaves items in state
  6  |  *
  7  |  * Expected: Adding Keyboard (id 1) and Mouse Pad (id 2), then clicking Checkout (clearCart)
  8  |  *           should completely empty the cart.
  9  |  * Actual (buggy): clearCart only drops 1 item using slice(1), leaving items in cart.
  10 |  */
  11 | 
  12 | async function assertEmpty(isEmpty: boolean, message: string) {
  13 |   if (!isEmpty) {
  14 |     await test.info().attach("btp-assertion", {
  15 |       body: Buffer.from(JSON.stringify({ actual: "items remaining in cart", expected: "cart is empty" })),
  16 |       contentType: "application/json",
  17 |     });
  18 |   }
> 19 |   expect(isEmpty, message).toBe(true);
     |                            ^ Error: BTP_ASSERTION: Cart should display 'Your cart is empty.' after checkout
  20 | }
  21 | 
  22 | test.describe("Case 004 — Cart clear on checkout", () => {
  23 |   test("checking out should empty all items from the cart", async ({ page }) => {
  24 |     const shop = new MiniShopPage(page);
  25 | 
  26 |     await shop.navigate();
  27 | 
  28 |     // Add multiple items
  29 |     await shop.addToCart(1);
  30 |     await shop.addToCart(2);
  31 | 
  32 |     // Click Checkout (which invokes clearCart)
  33 |     await shop.clickCheckout();
  34 | 
  35 |     await shop.takeScreenshot("screenshot");
  36 | 
  37 |     const empty = await shop.isCartEmpty();
  38 |     await assertEmpty(
  39 |       empty,
  40 |       "BTP_ASSERTION: Cart should display 'Your cart is empty.' after checkout"
  41 |     );
  42 |   });
  43 | });
  44 | 
```