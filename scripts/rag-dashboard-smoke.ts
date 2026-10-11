import { chromium, expect } from "@playwright/test";
import fs from "fs";
async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto("http://localhost:5173/cases/case-001");
    await page.getByRole("heading", { name: "Debugging assistant" }).waitFor();
    await page.getByText(/Offline demo retrieval/).waitFor();
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/ai/ask"));
    await page.getByRole("button", { name: "Ask with sources" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const answer = await response.json();
    expect(answer.telemetry.provider).toBe("lexical");
    expect(answer.telemetry.strategy).toBe("hybrid");
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.sources.every((source: any) => source.startLine > 0 && source.endLine >= source.startLine)).toBe(true);
    await page.getByText("Local source excerpts", { exact: true }).waitFor();
    const sources = page.locator("details");
    await expect(sources.first().locator("summary")).toContainText(/lines \d+–\d+/);
    await sources.first().locator("summary").click();
    await page.screenshot({ path: "artifacts/rag-upgrade-dashboard.png", fullPage: false });
    fs.writeFileSync("artifacts/rag-upgrade-dashboard-smoke.json", JSON.stringify({
      passed: true, runAt: new Date().toISOString(), scope: "Offline RAG UI/API smoke; no live semantic model",
      mode: answer.mode, telemetry: answer.telemetry, sources: answer.sources.map((source: any) => ({
        source: source.source, startLine: source.startLine, endLine: source.endLine, chunkId: source.chunkId,
      })), screenshot: "artifacts/rag-upgrade-dashboard.png",
    }, null, 2));
    console.log("RAG dashboard/API smoke passed");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
