import { test, expect } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

/**
 * Case 003 — Removing an item retains the item or clears entire cart
 *
 * Expected: Adding Keyboard (id 1) and Mouse Pad (id 2), then removing Keyboard (id 1)
 *           should result in Keyboard no longer in cart, while Mouse Pad remains.
 * Actual (buggy): Filter checks i.id === productId, keeping Keyboard and removing Mouse Pad.
 */

async function assertRemoval(hasRemovedItem: boolean, message: string) {
  if (hasRemovedItem) {
    await test.info().attach("btp-assertion", {
      body: Buffer.from(JSON.stringify({ actual: "item present", expected: "item removed" })),
      contentType: "application/json",
    });
  }
  expect(hasRemovedItem, message).toBe(false);
}

test.describe("Case 003 — Item removal from cart", () => {
  test("removing an item should remove that item and retain remaining items", async ({ page }) => {
    const shop = new MiniShopPage(page);

    await shop.navigate();

    // Add Keyboard and Mouse Pad
    await shop.addToCart(1);
    await shop.addToCart(2);

    // Remove Keyboard (id 1)
    await shop.removeItem(1);

    await shop.takeScreenshot("screenshot");

    const keyboardStillPresent = await shop.hasCartItem(1);
    await assertRemoval(
      keyboardStillPresent,
      "BTP_ASSERTION: Keyboard (id 1) should not be present in cart after removal"
    );

    const mousePadPresent = await shop.hasCartItem(2);
    expect(mousePadPresent, "Mouse Pad (id 2) should remain in cart").toBe(true);
  });
});
