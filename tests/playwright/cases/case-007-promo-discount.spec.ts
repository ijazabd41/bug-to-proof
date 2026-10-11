import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 007 — Async promo code application race condition drops concurrent cart updates
 *
 * Expected: Adding Keyboard ($10.00), applying promo code "SAVE20" (80ms async validation),
 * and concurrently adding Mouse Pad ($20.00) while validation is in flight should preserve both items.
 * Subtotal is $30.00, discounted 20% to $24.00.
 *
 * Actual (buggy): applyPromoCode captures a stale pre-await snapshot of items and overwrites
 * state upon completion, dropping the Mouse Pad added concurrently. Total displays $8.00.
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

test.describe("Case 007 — Async promo code race condition", () => {
  test("concurrent item addition during async promo validation is preserved", async ({ page }) => {
    const shop = new MiniShopPage(page);
    await shop.navigate();

    // 1. Add Keyboard ($10.00)
    await shop.addToCart(1);

    // 2. Start async promo code application
    const promoInput = page.getByTestId("promo-input");
    await promoInput.fill("SAVE20");
    await page.getByTestId("apply-promo-button").click();

    // 3. Concurrently add Mouse Pad ($20.00) while promo validation is in flight
    await shop.addToCart(2);

    // 4. Wait for promo applied message
    await page.getByText("Promo code applied!").waitFor({ state: "visible" });

    await shop.takeScreenshot("screenshot");

    const total = await shop.getCartTotal();
    await assertTotal(
      total,
      "$24.00",
      "BTP_ASSERTION: Cart total should be $24.00 reflecting both items after async promo discount"
    );
  });
});
