import { Page } from "@playwright/test";
import { TEST_IDS } from "@bug-to-proof/shared-types";

export class MiniShopPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.goto("/");
    // Wait until product cards are rendered — confirms React hydration is done
    await this.page
      .getByTestId(TEST_IDS.addToCart(1))
      .waitFor({ state: "visible" });
  }

  async addToCart(productId: number) {
    // Ensure the button is interactive before clicking
    const btn = this.page.getByTestId(TEST_IDS.addToCart(productId));
    await btn.waitFor({ state: "visible" });
    await btn.click();
    // Wait for the cart-total element to appear / update in the sidebar
    await this.page
      .getByTestId(TEST_IDS.cartTotal)
      .waitFor({ state: "visible" });
  }

  /** Navigate to /cart via the nav link */
  async goToCart() {
    await this.page.getByTestId("nav-cart-link").click();
    await this.page.waitForLoadState("networkidle");
  }

  async getCartTotal(): Promise<string> {
    const el = this.page.getByTestId(TEST_IDS.cartTotal);
    await el.waitFor({ state: "visible" });
    return el.innerText();
  }

  async takeScreenshot(name = "screenshot") {
    const PHASE = process.env.PHASE ?? "before";
    const CASE_ID = process.env.CASE_ID ?? "case-001";
    await this.page.screenshot({
      path: `artifacts/${CASE_ID}/${PHASE}/${name}.png`,
      fullPage: true,
    });
  }

  async clickCheckout() {
    await this.page.getByTestId(TEST_IDS.checkoutButton).click();
  }
}
