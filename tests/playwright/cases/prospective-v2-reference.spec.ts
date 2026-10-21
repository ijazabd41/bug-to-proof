import { expect, test } from "@playwright/test";
import { MiniShopPage } from "./helpers/minishop";

const caseId = process.env.CASE_ID ?? "";
test.skip(!caseId.startsWith("p2-"), "Prospective reference tests run only with an explicit case ID");

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
  const applyPromo = async (code: string, expectMessage = true) => {
    await page.getByTestId("promo-input").fill(code);
    await page.getByTestId("apply-promo-button").click();
    if (expectMessage) await expect(page.getByText(/Promo code applied!|Invalid promo code/)).toBeVisible();
    else await page.waitForTimeout(600);
  };

  switch (caseId) {
    case "p2-dev-total-first-item":
      await addKeyboard(); await addMousePad();
      await assertObserved((await page.getByTestId("cart-total").innerText()).trim(), "$30.00");
      break;
    case "p2-dev-quantity-stuck":
      await addKeyboard(); await addKeyboard();
      await assertObserved((await page.getByTestId("cart-item-quantity-1").innerText()).trim(), "×2");
      break;
    case "p2-total-extra-fee":
    case "p2-control-correct-total":
      await addKeyboard();
      await assertObserved((await page.getByTestId("cart-total").innerText()).trim(), "$10.00");
      break;
    case "p2-second-product-ignored":
      await addKeyboard(); await addMousePad();
      await assertObserved(String(await page.getByTestId("cart-item-2").count()), "1");
      break;
    case "p2-remove-mouse-removes-keyboard":
      await addKeyboard(); await addMousePad(); await page.getByTestId("remove-from-cart-2").click();
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "1");
      break;
    case "p2-checkout-keeps-cart": {
      await addKeyboard(); await page.getByTestId("checkout-button").click();
      const sidebarEmpty = await page.getByText("Your cart is empty.").count() > 0;
      await addKeyboard(); await page.getByTestId("nav-cart-link").click();
      await page.getByTestId("checkout-button").click();
      const cartPageEmpty = await page.getByText("Your cart is empty.").count() > 0;
      await assertObserved(`${sidebarEmpty}|${cartPageEmpty}`, "true|true");
      break;
    }
    case "p2-cart-link-opens-shop":
    case "p2-control-correct-navigation":
      await page.getByTestId("nav-cart-link").click();
      await assertObserved(new URL(page.url()).pathname, "/cart");
      break;
    case "p2-back-link-stays-cart":
      await page.getByTestId("nav-cart-link").click();
      await page.getByTestId("back-to-shop").click();
      await assertObserved(new URL(page.url()).pathname, "/");
      break;
    case "p2-quantity-label-off-by-one":
      await addKeyboard();
      await assertObserved((await page.getByTestId("cart-item-quantity-1").innerText()).trim(), "×1");
      break;
    case "p2-line-price-ignores-quantity":
      await addKeyboard(); await addKeyboard();
      await assertObserved((await page.getByTestId("cart-item-1").locator("span").nth(2).innerText()).trim(), "$20.00");
      break;
    case "p2-invalid-promo-accepted":
      await addKeyboard(); await applyPromo("NOTREAL");
      await assertObserved((await page.getByText(/Promo code applied!|Invalid promo code/).innerText()).trim(), "Invalid promo code");
      break;
    case "p2-promo-clears-items":
      await addKeyboard(); await applyPromo("SAVE20", false);
      await assertObserved(String(await page.getByTestId("cart-item-1").count()), "1");
      break;
    case "p2-shipping-fee-six":
      await addKeyboard();
      await assertObserved((await page.getByTestId("shipping-fee").innerText()).trim(), "$5.00");
      break;
    case "p2-promo-discount-ten":
      await addKeyboard(); await applyPromo("SAVE20");
      await assertObserved((await page.getByTestId("cart-total").innerText()).trim(), "$8.00");
      break;
    default:
      throw new Error(`Unknown prospective reference case: ${caseId}`);
  }
});
