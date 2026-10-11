import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 006 — Navbar cart counter shows number of unique items instead of total quantity
 *
 * Expected: Adding Keyboard (x2) + Mouse Pad (x1) should show "Cart (3)" in navbar.
 * Actual (buggy): Shows "Cart (2)" — only counting unique item types.
 */

async function assertNavCount(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual, expected })),
      contentType: "application/json",
    });
  }
  expect(actual, message).toBe(expected);
}

test.describe("Case 006 — Navbar cart item counter", () => {
  test("navbar cart counter should reflect total sum of item quantities", async ({ page }) => {
    const shop = new MiniShopPage(page);
    await shop.navigate();

    // Add Keyboard twice (qty = 2)
    await shop.addToCart(1);
    await shop.addToCart(1);

    // Add Mouse Pad once (qty = 1)
    await shop.addToCart(2);

    await shop.takeScreenshot("screenshot");

    const navText = await page.getByTestId("nav-cart-link").innerText();
    await assertNavCount(
      navText.trim(),
      "Cart (3)",
      "BTP_ASSERTION: Navbar cart link should display Cart (3) for 3 total units"
    );
  });
});
