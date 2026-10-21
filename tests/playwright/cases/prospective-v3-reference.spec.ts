import { expect, test } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

const caseId = process.env.CASE_ID ?? "";
test.skip(!caseId.startsWith("p3-"), "Prospective v3 references run only with an explicit case ID");

async function assertObserved(actual: string, expected: string) {
  if (actual !== expected) await test.info().attach("btp-assertion", {
    body: Buffer.from(JSON.stringify({ actual, expected })), contentType: "application/json",
  });
  expect(actual, `BTP_ASSERTION: ${caseId}`).toBe(expected);
}

test(`independent MiniShop reference behavior for ${caseId}`, async ({ page }) => {
  const shop = new MiniShopPage(page);
  await shop.navigate();
  const addKeyboard = () => shop.addToCart(1);
  const addMousePad = () => shop.addToCart(2);
  const addWebcam = () => shop.addToCart(4);
  const applyPromo = async (code: string) => {
    await page.getByTestId("promo-input").fill(code);
    await page.getByTestId("apply-promo-button").click();
    await expect(page.getByText(/Promo code applied!|Invalid promo code/)).toBeVisible();
  };

  switch (caseId) {
    case "p3-dev-free-shipping-at-fifty":
    case "p3-control-free-shipping":
      await addMousePad(); await addMousePad(); await addKeyboard();
      await assertObserved((await page.getByTestId("shipping-fee").innerText()).trim(), "$0.00");
      break;
    case "p3-dev-webcam-price-label":
      await assertObserved((await page.getByTestId("add-to-cart-4").locator("..").locator("span").nth(1).innerText()).trim(), "$35.00");
      break;
    case "p3-nav-count-ignores-quantity":
      await addKeyboard(); await addKeyboard();
      await assertObserved((await page.getByTestId("nav-cart-link").innerText()).trim(), "Cart (2)");
      break;
    case "p3-remove-keyboard-does-nothing":
      await addKeyboard(); await page.getByTestId("remove-from-cart-1").click();
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "0");
      break;
    case "p3-cart-page-checkout-noop":
      await addKeyboard(); await page.getByTestId("nav-cart-link").click(); await page.getByTestId("checkout-button").click();
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "0");
      break;
    case "p3-cart-page-total-adds-five":
      await addKeyboard(); await page.getByTestId("nav-cart-link").click();
      await assertObserved((await page.getByTestId("cart-total").innerText()).trim(), "$10.00");
      break;
    case "p3-webcam-missing-from-catalog":
      await assertObserved(String(await page.getByText("Webcam", { exact: true }).count()), "1");
      break;
    case "p3-lowercase-promo-rejected":
      await addKeyboard(); await applyPromo("save20");
      await assertObserved((await page.getByText(/Promo code applied!|Invalid promo code/).innerText()).trim(), "Promo code applied!");
      break;
    case "p3-valid-promo-shows-error":
      await addKeyboard(); await applyPromo("SAVE20");
      await assertObserved((await page.getByText(/Promo code applied!|Invalid promo code/).innerText()).trim(), "Promo code applied!");
      break;
    case "p3-webcam-adds-keyboard":
      await addWebcam();
      await assertObserved(String(await page.getByTestId("cart-item-4").count()), "1");
      break;
    case "p3-shipping-free-too-early":
      await addMousePad();
      await assertObserved((await page.getByTestId("shipping-fee").innerText()).trim(), "$5.00");
      break;
    case "p3-promo-discounts-first-item-only":
      await addKeyboard(); await addMousePad(); await applyPromo("SAVE20");
      await assertObserved((await page.getByTestId("cart-total").innerText()).trim(), "$24.00");
      break;
    case "p3-cart-webcam-name-wrong":
      { const catalogName = (await page.getByTestId("add-to-cart-4").locator("..").locator("span").first().innerText()).trim();
      await addWebcam();
      const cartName = (await page.getByTestId("cart-item-4").locator("span").first().innerText()).trim();
      await assertObserved(`${catalogName}|${cartName}`, "Webcam|Webcam"); }
      break;
    case "p3-back-link-clears-cart":
      await addKeyboard(); await page.getByTestId("nav-cart-link").click(); await page.getByTestId("back-to-shop").click();
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "1");
      break;
    case "p3-control-remove-mouse":
      await addKeyboard(); await addMousePad(); await page.getByTestId("remove-from-cart-2").click();
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "1");
      break;
    default:
      throw new Error(`Unknown prospective v3 reference case: ${caseId}`);
  }
});
