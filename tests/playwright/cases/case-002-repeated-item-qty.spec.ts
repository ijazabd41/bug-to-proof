import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 002 — Adding an existing item does not increment its quantity
 *
 * Expected: Adding Keyboard ($10) twice should show quantity "×2" in the cart.
 * Actual (buggy): Quantity resets to / remains "×1".
 */

async function assertQuantity(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual, expected })),
      contentType: "application/json",
    });
  }
  expect(actual, message).toBe(expected);
}

test.describe("Case 002 — Repeated item quantity increment", () => {
  test("adding an item twice should increment its quantity to 2", async ({ page }) => {
    const shop = new MiniShopPage(page);

    await shop.navigate();

    // Add Keyboard first time
    await shop.addToCart(1);

    // Add Keyboard second time
    await shop.addToCart(1);

    await shop.takeScreenshot("screenshot");

    const qty = await shop.getItemQuantity(1);
    await assertQuantity(
      qty,
      "×2",
      "BTP_ASSERTION: Item quantity should be ×2 after adding Keyboard twice"
    );
  });
});
