import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 004 — Clear cart leaves items in state
 *
 * Expected: Adding Keyboard (id 1) and Mouse Pad (id 2), then clicking Checkout (clearCart)
 *           should completely empty the cart.
 * Actual (buggy): clearCart only drops 1 item using slice(1), leaving items in cart.
 */

async function assertEmpty(isEmpty: boolean, message: string) {
  if (!isEmpty) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual: "items remaining in cart", expected: "cart is empty" })),
      contentType: "application/json",
    });
  }
  expect(isEmpty, message).toBe(true);
}

test.describe("Case 004 — Cart clear on checkout", () => {
  test("checking out should empty all items from the cart", async ({ page }) => {
    const shop = new MiniShopPage(page);

    await shop.navigate();

    // Add multiple items
    await shop.addToCart(1);
    await shop.addToCart(2);

    // Click Checkout (which invokes clearCart)
    await shop.clickCheckout();

    await shop.takeScreenshot("screenshot");

    const empty = await shop.isCartEmpty();
    await assertEmpty(
      empty,
      "BTP_ASSERTION: Cart should display 'Your cart is empty.' after checkout"
    );
  });
});
