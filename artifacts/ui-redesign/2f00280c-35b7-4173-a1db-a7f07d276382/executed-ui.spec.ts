
import { test, expect } from "@playwright/test";
test.setTimeout(90_000);
test.use({ viewport: { width: 1440, height: 1000 } });
test.beforeEach(() => { expect.configure({ timeout: 15_000 }); });
async function capture(page: any, testInfo: any, name: string) {
  const file = testInfo.outputPath(name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test("desktop case workspace and report submission", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bug cases." })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const cases = await (await page.request.get("/api/cases")).json();
  expect(cases.length).toBeGreaterThan(0);
  await expect(page.locator(".case-title").first()).toBeVisible();
  const viewport = page.viewportSize()!;
  const table = await page.locator(".cases-panel").boundingBox();
  const form = await page.locator(".report-panel").boundingBox();
  expect(form!.x).toBeGreaterThan(table!.x + table!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await capture(page, testInfo, "desktop-overview");

  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("alert")).toHaveText("Title is required.");
  await expect(page.getByRole("textbox", { name: "Title *", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Title *", exact: true }).fill("UI smoke report");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("alert")).toHaveText("Description is required.");
  await page.getByLabel("Description", { exact: false }).fill("Two products have an incorrect total.");
  await page.getByLabel("Reproduction steps").fill("Add two products.");
  await page.getByLabel("Expected behavior").fill("Sum both prices.");
  await page.getByLabel("Actual behavior").fill("Only the first price appears.");
  // Intercept submission to verify the payload without modifying real case data.
  let submitted: any;
  const created = { ...cases[0], id: "ui-smoke-created", title: "UI smoke report", description: "", status: "REPORTED", evidence: [], reproduction: null, patch: null, verification: null };
  await page.route("**/api/cases", async route => {
    if (route.request().method() !== "POST") return route.continue();
    submitted = route.request().postDataJSON();
    created.description = submitted.description;
    await route.fulfill({ json: created, status: 201 });
  });
  await page.route("**/api/cases/ui-smoke-created", route => route.fulfill({ json: created }));
  await page.route("**/api/ai/cases/ui-smoke-created/repair-runs", route => route.fulfill({ json: [] }));
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page).toHaveURL(/cases\/ui-smoke-created$/);
  await expect(page.getByRole("heading", { name: "UI smoke report", exact: true })).toBeVisible();
  expect(submitted.title).toBe("UI smoke report");
  expect(submitted.description).toContain("Steps to reproduce:\nAdd two products.");
  expect(submitted.description).toContain("Expected behavior:\nSum both prices.");
  expect(submitted.description).toContain("Actual behavior:\nOnly the first price appears.");
  await expect(page.getByText("Not run yet.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("real case evidence on desktop and mobile", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  const cases = await (await page.request.get("/api/cases")).json();
  const selected = cases.find((c: any) => c.evidence?.length) ?? cases[0];
  await page.goto("/cases/" + selected.id);
  await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before / After Comparison", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Debugging & AI Repair Assistant", exact: true })).toBeVisible();
  await page.locator(".repair-assistant").getByText("Ask source code question", { exact: true }).waitFor();
  await page.waitForFunction(() => Array.from(document.images).every(img => img.complete));
  const evidence = await page.locator(".verification-overview").boundingBox();
  const assistant = await page.locator(".repair-assistant").boundingBox();
  expect(assistant!.x).toBeGreaterThan(evidence!.x + evidence!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await capture(page, testInfo, "desktop-detail");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const before = await page.locator(".comparison-card").first().boundingBox();
  const after = await page.locator(".comparison-card").last().boundingBox();
  expect(after!.y).toBeGreaterThan(before!.y);
  await capture(page, testInfo, "mobile-detail");
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, testInfo, "mobile-overview");
});
