# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-006-nav-cart-count.spec.ts >> Case 006 — Navbar cart item counter >> navbar cart counter should reflect total sum of item quantities
- Location: tests\playwright\cases\case-006-nav-cart-count.spec.ts:22:7

# Error details

```
Error: BTP_ASSERTION: Navbar cart link should display Cart (3) for 3 total units

expect(received).toBe(expected) // Object.is equality

Expected: "Cart (3)"
Received: "Cart (2)"
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
        - generic [ref=e36]: ×2
        - generic [ref=e37]: $20.00
        - button "Remove item" [ref=e38] [cursor=pointer]: ×
      - generic [ref=e39]:
        - generic [ref=e40]: Mouse Pad
        - generic [ref=e41]: ×1
        - generic [ref=e42]: $20.00
        - button "Remove item" [ref=e43] [cursor=pointer]: ×
      - generic [ref=e44]:
        - textbox "Promo code" [ref=e45]
        - button "Apply" [ref=e46] [cursor=pointer]
      - generic [ref=e47]:
        - generic [ref=e48]: Shipping
        - generic [ref=e49]: $5.00
      - generic [ref=e50]:
        - generic [ref=e51]: Total
        - generic [ref=e52]: $40.00
      - button "Checkout" [ref=e53] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { MiniShopPage } from "./helpers/minishop";
  3  | 
  4  | /**
  5  |  * Case 006 — Navbar cart counter shows number of unique items instead of total quantity
  6  |  *
  7  |  * Expected: Adding Keyboard (x2) + Mouse Pad (x1) should show "Cart (3)" in navbar.
  8  |  * Actual (buggy): Shows "Cart (2)" — only counting unique item types.
  9  |  */
  10 | 
  11 | async function assertNavCount(actual: string, expected: string, message: string) {
  12 |   if (actual !== expected) {
  13 |     await test.info().attach("btp-assertion", {
  14 |       body: Buffer.from(JSON.stringify({ actual, expected })),
  15 |       contentType: "application/json",
  16 |     });
  17 |   }
> 18 |   expect(actual, message).toBe(expected);
     |                           ^ Error: BTP_ASSERTION: Navbar cart link should display Cart (3) for 3 total units
  19 | }
  20 | 
  21 | test.describe("Case 006 — Navbar cart item counter", () => {
  22 |   test("navbar cart counter should reflect total sum of item quantities", async ({ page }) => {
  23 |     const shop = new MiniShopPage(page);
  24 |     await shop.navigate();
  25 | 
  26 |     // Add Keyboard twice (qty = 2)
  27 |     await shop.addToCart(1);
  28 |     await shop.addToCart(1);
  29 | 
  30 |     // Add Mouse Pad once (qty = 1)
  31 |     await shop.addToCart(2);
  32 | 
  33 |     await shop.takeScreenshot("screenshot");
  34 | 
  35 |     const navText = await page.getByTestId("nav-cart-link").innerText();
  36 |     await assertNavCount(
  37 |       navText.trim(),
  38 |       "Cart (3)",
  39 |       "BTP_ASSERTION: Navbar cart link should display Cart (3) for 3 total units"
  40 |     );
  41 |   });
  42 | });
  43 | 
```