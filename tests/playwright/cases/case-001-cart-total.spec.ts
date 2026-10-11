import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 001 — Cart total only reflects first item price
 *
 * Expected: Adding Keyboard ($10) + Mouse Pad ($20) should show total $30.00
 * Actual (buggy): Total shows $10.00 — only first item's price
 *
 * This test FAILS on the buggy MiniShop (before patch).
 * This test PASSES on the fixed MiniShop (after patch).
 *
 * Phase is controlled by PHASE env var (set by API runner):
 *   PHASE=before → test expected to fail
 *   PHASE=after  → test expected to pass
 */

async function assertTotal(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual, expected })), contentType: "application/json",
    });
  }
  expect(actual, message).toBe(expected);
}

test.describe("Case 001 — Cart total calculation", () => {
  test("cart total should equal sum of all item prices", async ({ page }) => {
    const shop = new MiniShopPage(page);

    // Navigate to MiniShop
    await shop.navigate();

    // Add Keyboard ($10.00)
    await shop.addToCart(1);

    // Add Mouse Pad ($20.00)
    await shop.addToCart(2);

    // Take screenshot (saved to artifacts/<caseId>/<phase>/screenshot.png)
    await shop.takeScreenshot("screenshot");

    // Assert: cart total must be $30.00
    const total = await shop.getCartTotal();
    await assertTotal(total, "$30.00", "BTP_ASSERTION: Cart total should be $30.00 after adding $10 + $20 items");
  });

  test("cart total should update when items are added incrementally", async ({ page }) => {
    const shop = new MiniShopPage(page);
    await shop.navigate();

    // Add single item first
    await shop.addToCart(1);
    let total = await shop.getCartTotal();
    await assertTotal(total, "$10.00", "BTP_ASSERTION: After adding Keyboard only, total should be $10.00");

    // Add second item
    await shop.addToCart(2);
    total = await shop.getCartTotal();
    await assertTotal(total, "$30.00", "BTP_ASSERTION: After adding Mouse Pad, total should be $30.00");
  });
});
