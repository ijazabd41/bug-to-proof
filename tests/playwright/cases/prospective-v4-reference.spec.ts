import { expect, test } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

const caseId = process.env.CASE_ID ?? "";
test.skip(!caseId.startsWith("p4-"), "Prospective v4 references run only with an explicit case ID");

async function assertObserved(actual: string, expected: string) {
  if (actual !== expected) await test.info().attach("btp-assertion", {
    body: Buffer.from(JSON.stringify({ actual, expected })), contentType: "application/json",
  });
  expect(actual, `BTP_ASSERTION: ${caseId}`).toBe(expected);
}

test(`independent MiniShop reference behavior for ${caseId}`, async ({ page }) => {
  const shop = new MiniShopPage(page);
  await shop.navigate();
  const add = (productId: number) => shop.addToCart(productId);
  const text = async (testId: string) => (await page.getByTestId(testId).innerText()).trim();
  const count = async (testId: string) => String(await page.getByTestId(testId).count());
  const applyPromo = async (code: string) => {
    await page.getByTestId("promo-input").fill(code);
    await page.getByTestId("apply-promo-button").click();
    await page.waitForTimeout(600);
  };

  switch (caseId) {
    case "p4-dev-promo-success-message-absent":
      await add(1); await applyPromo("SAVE20");
      await assertObserved(await count("promo-status"), "1");
      break;
    case "p4-dev-mouse-catalog-price-wrong":
      await assertObserved(await text("product-price-2"), "$20.00");
      break;
    case "p4-third-keyboard-add-capped":
      await add(1); await add(1); await add(1);
      await assertObserved(await text("cart-item-quantity-1"), "×3");
      break;
    case "p4-remove-mouse-clears-keyboard":
      await add(1); await add(2); await page.getByTestId("remove-from-cart-2").click();
      await assertObserved(await count("cart-item-1"), "1");
      break;
    case "p4-sidebar-checkout-keeps-mouse":
      await add(1); await add(2); await page.getByTestId("checkout-button").click();
      await assertObserved(await count("cart-item-2"), "0");
      break;
    case "p4-usb-total-under-counts":
      await add(3); await assertObserved(await text("cart-total"), "$15.00");
      break;
    case "p4-webcam-catalog-name-camera":
      await assertObserved(await text("product-name-4"), "Webcam");
      break;
    case "p4-keyboard-cart-name-mouse":
      await add(1); await assertObserved(await text("cart-item-name-1"), "Keyboard");
      break;
    case "p4-forty-five-cart-free-shipping":
      await add(1); await add(2); await add(3);
      await assertObserved(await text("shipping-fee"), "$5.00");
      break;
    case "p4-promo-success-without-discount":
      await add(1); await applyPromo("SAVE20");
      await assertObserved(await text("cart-total"), "$8.00");
      break;
    case "p4-invalid-promo-shows-success":
      await add(1); await applyPromo("NOPE");
      await assertObserved(await text("promo-status"), "Invalid promo code");
      break;
    case "p4-mouse-adds-two-at-once":
      await add(2); await assertObserved(await text("cart-item-quantity-2"), "×1");
      break;
    case "p4-single-keyboard-nav-count-zero":
      await add(1); await assertObserved(await text("nav-cart-link"), "Cart (1)");
      break;
    case "p4-cart-page-ignores-quantity":
      await add(1); await add(1); await page.getByTestId("nav-cart-link").click();
      await assertObserved(await text("cart-total"), "$20.00");
      break;
    case "p4-control-valid-promo":
      await add(1); await applyPromo("SAVE20");
      await assertObserved(await text("promo-status"), "Promo code applied!");
      break;
    case "p4-control-webcam-price":
      await assertObserved(await text("product-price-4"), "$35.00");
      break;
    default:
      throw new Error(`Unknown prospective v4 reference case: ${caseId}`);
  }
});
