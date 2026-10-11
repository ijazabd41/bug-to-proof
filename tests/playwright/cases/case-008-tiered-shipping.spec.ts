import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 008 — Coordinated multi-file defect in tiered shipping calculation and display
 *
 * Expected: Adding 5 Keyboards ($10 x 5 = $50.00) meets the $50 free shipping threshold.
 * Shipping fee should display "$0.00".
 * Actual (buggy): Shipping displays "$5.00" because cartStore calculates shipping > 50 strictly
 * and Cart component hardcodes the fee display.
 */

async function assertShipping(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual, expected })),
      contentType: "application/json",
    });
  }
  expect(actual, message).toBe(expected);
}

test.describe("Case 008 — Coordinated tiered shipping calculation and display", () => {
  test("shipping fee should be $0.00 for orders of $50.00 or more", async ({ page }) => {
    const shop = new MiniShopPage(page);
    await shop.navigate();

    // Add Keyboard 5 times ($10.00 x 5 = $50.00)
    for (let i = 0; i < 5; i++) {
      await shop.addToCart(1);
    }

    await shop.takeScreenshot("screenshot");

    const shippingEl = page.getByTestId("shipping-fee");
    await shippingEl.waitFor({ state: "visible" });
    const shippingFee = (await shippingEl.innerText()).trim();

    await assertShipping(
      shippingFee,
      "$0.00",
      "BTP_ASSERTION: Shipping fee should be $0.00 (free shipping) on $50.00 total"
    );
  });
});
