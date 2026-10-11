import { chromium } from "@playwright/test";
import fs from "fs";
async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto("http://localhost:5173/cases/case-001");
    await page.getByRole("heading", { name: "Debugging assistant" }).waitFor();
    await page.getByRole("button", { name: "Ask with sources" }).click();
    await page.getByText("Local source excerpts", { exact: true }).waitFor();
    await page.screenshot({ path: "artifacts/portfolio-dashboard.png", fullPage: true });
    fs.writeFileSync("artifacts/portfolio-dashboard-smoke.json", JSON.stringify({
      check: "Dashboard rendered the assistant and returned offline RAG excerpts",
      passed: true, screenshot: "artifacts/portfolio-dashboard.png", runAt: new Date().toISOString(),
      scope: "UI smoke check; case proof remains in evidence-runner reports",
    }, null, 2));
    console.log("Dashboard RAG smoke check passed");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
