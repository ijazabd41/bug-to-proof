import path from "path";
import { Page } from "@playwright/test";
import { TEST_IDS } from "@bug-to-proof/shared-types";

/** Workspace root — two levels up from tests/playwright/ */
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

export class MiniShopPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  async addToCart(productId: number) {
    await this.page.getByTestId(TEST_IDS.addToCart(productId)).click();
  }

  /** Navigate to /cart via the nav link */
  async goToCart() {
    await this.page.getByTestId("nav-cart-link").click();
    await this.page.waitForLoadState("networkidle");
  }

  async getCartTotal(): Promise<string> {
    return this.page.getByTestId(TEST_IDS.cartTotal).innerText();
  }

  async takeScreenshot(name = "screenshot") {
    const PHASE = process.env.PHASE ?? "before";
    const CASE_ID = process.env.CASE_ID ?? "case-001";
    await this.page.screenshot({
      path: path.join(WORKSPACE_ROOT, "artifacts", CASE_ID, PHASE, `${name}.png`),
      fullPage: true,
    });
  }

  async clickCheckout() {
    await this.page.getByTestId(TEST_IDS.checkoutButton).click();
  }
}
