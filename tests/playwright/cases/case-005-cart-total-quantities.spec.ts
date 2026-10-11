import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 005 — Cart total calculation ignores item quantities
 *
 * Expected: Adding Keyboard ($10) twice + Mouse Pad ($20) once should equal $40.00
 * Actual (buggy): Total sums item.price ($10 + $20 = $30.00) without multiplying by quantity.
 */

async function assertTotal(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual, expected })),
      contentType: "application/json",
    });
  }
  expect(actual, message).toBe(expected);
}

test.describe("Case 005 — Cart total quantity multiplication", () => {
  test("cart total should multiply price by quantity for repeated items", async ({ page }) => {
    const shop = new MiniShopPage(page);

    await shop.navigate();

    // Add Keyboard ($10.00) twice -> $20.00
    await shop.addToCart(1);
    await shop.addToCart(1);

    // Add Mouse Pad ($20.00) once -> $20.00
    await shop.addToCart(2);

    await shop.takeScreenshot("screenshot");

    // Total must be $40.00
    const total = await shop.getCartTotal();
    await assertTotal(
      total,
      "$40.00",
      "BTP_ASSERTION: Cart total should be $40.00 after adding $10×2 + $20×1"
    );
  });
});
