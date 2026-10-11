# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-001-cart-total.spec.ts >> Case 001 — Cart total calculation >> cart total should update when items are added incrementally
- Location: tests\playwright\cases\case-001-cart-total.spec.ts:48:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/
Call log:
  - navigating to "http://localhost:5174/", waiting until "load"

```

# Test source

```ts
  1  | import path from "path";
  2  | import { Page } from "@playwright/test";
  3  | import { TEST_IDS } from "@bug-to-proof/shared-types";
  4  | 
  5  | export class MiniShopPage {
  6  |   constructor(private readonly page: Page) {}
  7  | 
  8  |   async navigate() {
> 9  |     await this.page.goto("/");
     |                     ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/
  10 |     // Wait until product cards are rendered — confirms React hydration is done
  11 |     await this.page
  12 |       .getByTestId(TEST_IDS.addToCart(1))
  13 |       .waitFor({ state: "visible" });
  14 |   }
  15 | 
  16 |   async addToCart(productId: number) {
  17 |     // Ensure the button is interactive before clicking
  18 |     const btn = this.page.getByTestId(TEST_IDS.addToCart(productId));
  19 |     await btn.waitFor({ state: "visible" });
  20 |     await btn.click();
  21 |     // Wait for the cart-total element to appear / update in the sidebar
  22 |     await this.page
  23 |       .getByTestId(TEST_IDS.cartTotal)
  24 |       .waitFor({ state: "visible" });
  25 |   }
  26 | 
  27 |   /** Navigate to /cart via the nav link */
  28 |   async goToCart() {
  29 |     await this.page.getByTestId("nav-cart-link").click();
  30 |     await this.page.waitForLoadState("networkidle");
  31 |   }
  32 | 
  33 |   async getCartTotal(): Promise<string> {
  34 |     const el = this.page.getByTestId(TEST_IDS.cartTotal);
  35 |     await el.waitFor({ state: "visible" });
  36 |     return el.innerText();
  37 |   }
  38 | 
  39 |   async takeScreenshot(name = "screenshot") {
  40 |     const PHASE = process.env.PHASE ?? "before";
  41 |     const CASE_ID = process.env.CASE_ID ?? "case-001";
  42 |     await this.page.screenshot({
  43 |       path: path.join(process.env.BTP_ARTIFACT_DIR ?? `artifacts/${CASE_ID}/${PHASE}`, `${name}.png`),
  44 |       fullPage: true,
  45 |     });
  46 |   }
  47 | 
  48 |   async removeItem(productId: number) {
  49 |     const btn = this.page.getByTestId(`remove-from-cart-${productId}`);
  50 |     await btn.waitFor({ state: "visible" });
  51 |     await btn.click();
  52 |   }
  53 | 
  54 |   async getItemQuantity(productId: number): Promise<string> {
  55 |     const el = this.page.getByTestId(TEST_IDS.cartItemQuantity(productId));
  56 |     await el.waitFor({ state: "visible" });
  57 |     return el.innerText();
  58 |   }
  59 | 
  60 |   async hasCartItem(productId: number): Promise<boolean> {
  61 |     const el = this.page.getByTestId(TEST_IDS.cartItem(productId));
  62 |     return (await el.count()) > 0;
  63 |   }
  64 | 
  65 |   async isCartEmpty(): Promise<boolean> {
  66 |     const el = this.page.getByText("Your cart is empty.");
  67 |     return (await el.count()) > 0;
  68 |   }
  69 | 
  70 |   async clickCheckout() {
  71 |     await this.page.getByTestId(TEST_IDS.checkoutButton).click();
  72 |   }
  73 | }
  74 | 
```