import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { runTest } from "../services/api/src/runner/playwrightRunner";
import { WORKSPACE_ROOT } from "../services/api/src/utils/paths";

// Keep UI smoke specs outside the permanent repair-test fingerprint. The exact
// executed spec is archived alongside its runner report for review.
const source = String.raw`
import { test, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(90_000);
test.use({ viewport: { width: 1440, height: 1000 } });
async function capture(page: any, testInfo: any, name: string) {
  const file = testInfo.outputPath(name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test("desktop case workspace and report submission", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Investigations." })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const cases = await (await page.request.get("/api/cases")).json();
  expect(cases.length).toBeGreaterThan(0);
  const searchTerm = "cart";
  await page.getByRole("searchbox", { name: "Search cases" }).fill(searchTerm);
  await expect(page.locator(".case-title")).toHaveCount(cases.filter((item: any) => [item.title, item.description, item.id].some((value: string) => value.toLowerCase().includes(searchTerm))).length);
  await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  await page.getByRole("combobox", { name: "Filter by status" }).selectOption(cases[0].status);
  await expect(page.locator(".case-title")).toHaveCount(cases.filter((item: any) => item.status === cases[0].status).length);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".case-title").first()).toBeVisible();
  const viewport = page.viewportSize()!;
  const table = await page.locator(".cases-panel").boundingBox();
  expect(table!.width).toBeGreaterThan(900);
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await capture(page, testInfo, "desktop-overview");

  await page.getByRole("button", { name: "New report" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(Math.abs(dialog!.x + dialog!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  await capture(page, testInfo, "desktop-report-form");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("alert")).toHaveText("Title is required.");
  await expect(page.getByRole("textbox", { name: "Title *", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Title *", exact: true }).fill("UI smoke report");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("alert")).toHaveText("Description is required.");
  await page.getByLabel("Description", { exact: false }).fill("Two products have an incorrect total.");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("alert")).toHaveText("Reproduction steps are required.");
  await page.getByLabel("Reproduction steps", { exact: false }).fill("Add two products.");
  await page.getByLabel("Expected behavior", { exact: false }).fill("Sum both prices.");
  await page.getByLabel("Actual behavior", { exact: false }).fill("Only the first price appears.");
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
  expect(submitted.steps).toEqual(["Add two products."]);
  expect(submitted.expected).toBe("Sum both prices.");
  expect(submitted.actual).toBe("Only the first price appears.");
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
  await page.locator(".repair-assistant").getByLabel("Ask a source-code question").waitFor();
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
  await expect(page.locator(".case-card").first()).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, testInfo, "mobile-overview");
  await page.getByRole("button", { name: "New report" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, testInfo, "mobile-report-form");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("incomplete report fields stay aligned and required", async ({ page }, testInfo) => {
  const cases = await (await page.request.get("/api/cases")).json();
  const selected = cases[0];
  const incomplete = {
    ...selected,
    reproduction: { ...selected.reproduction, testFile: "" },
    report: { schemaVersion: "1.0", steps: [], expected: "Both prices are included", actual: "Only one price is included", startPath: "", context: "" },
    reportCompleteness: { complete: false, missingFields: ["steps"] },
  };
  await page.route("**/api/cases/" + selected.id, route => route.fulfill({ json: incomplete }));
  await page.goto("/cases/" + selected.id);
  const form = page.getByRole("form", { name: "Clarify bug report" });
  await expect(form).toBeVisible();
  const steps = form.getByLabel("Reproduction steps", { exact: false });
  const expected = form.getByLabel("Expected behavior", { exact: false });
  const actual = form.getByLabel("Actual behavior", { exact: false });
  await expect(steps).toHaveAttribute("required", "");
  await expect(expected).toHaveAttribute("required", "");
  await expect(actual).toHaveAttribute("required", "");
  const formBox = await form.boundingBox();
  const stepsBox = await steps.boundingBox();
  expect(stepsBox!.width).toBeGreaterThan(formBox!.width * 0.9);
  await form.getByRole("button", { name: "Save report details" }).click();
  await expect(form.getByRole("alert")).toHaveText("Reproduction steps are required.");
  await capture(page, testInfo, "desktop-clarification");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, testInfo, "mobile-clarification");
});
`;

async function main() {
  const runId = randomUUID();
  const dir = path.join(WORKSPACE_ROOT, "artifacts/ui-redesign", runId);
  const file = path.join(WORKSPACE_ROOT, `tests/playwright/cases/ui-smoke-${runId}.spec.ts`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, source, { flag: "wx" });
  try {
    const result = await runTest("dashboard-ui", path.relative(WORKSPACE_ROOT, file), "after", {
      targetUrl: process.env.DASHBOARD_URL ?? "http://localhost:5173", artifactDir: dir, timeoutMs: 180_000,
    });
    const report = {
      scope: "UI design regression only; not bug repair proof. Screenshots show real saved cases. Submission is intercepted to avoid data mutation.",
      ...result,
    };
    fs.writeFileSync(path.join(dir, "executed-ui.spec.ts"), source);
    fs.writeFileSync(path.join(dir, "ui-report.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(WORKSPACE_ROOT, "artifacts/ui-redesign-latest.json"), JSON.stringify({ directory: dir, ...report }, null, 2));
    console.log(JSON.stringify({ directory: dir, outcome: result.outcome, actual: result.actual, testIds: result.testIds }, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } finally { fs.unlinkSync(file); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
