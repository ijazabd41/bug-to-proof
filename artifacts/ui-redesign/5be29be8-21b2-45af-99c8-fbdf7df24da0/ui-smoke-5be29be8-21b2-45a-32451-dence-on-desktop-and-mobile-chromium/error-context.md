# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-smoke-5be29be8-21b2-45af-99c8-fbdf7df24da0.spec.ts >> real case evidence on desktop and mobile
- Location: tests\playwright\cases\ui-smoke-5be29be8-21b2-45af-99c8-fbdf7df24da0.spec.ts:53:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('table')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('table') with timeout 5000ms
  - waiting for getByRole('table')

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- complementary:
  - link "Bug-to-Proof":
    - /url: /
  - text: WORKSPACE
  - navigation "Main navigation":
    - link "Bug cases":
      - /url: /
  - text: THE WORKFLOW
  - paragraph: Every fix starts with a proven failure.
  - list:
    - listitem: Report the behavior
    - listitem: Reproduce the failure
    - listitem: Review the patch
    - listitem: Verify with evidence
  - strong: Local workspace
  - text: Evidence-backed repair
- banner: Engineering workspace Proof over promises
- main:
  - text: FROM REPORT TO RESOLUTION
  - heading "Bug cases." [level=1]
  - paragraph: Reproduce the failure. Review the fix. Keep the proof.
  - link "Report a bug":
    - /url: "#bug-title"
  - list "Repair workflow":
    - listitem:
      - text: "1"
      - strong: Report
      - text: Describe the issue
    - listitem:
      - text: "2"
      - strong: Reproduce
      - text: Confirm the behavior
    - listitem:
      - text: "3"
      - strong: Review patch
      - text: Assess the proposed fix
    - listitem:
      - text: "4"
      - strong: Verify
      - text: Run tests and checks
  - region "Your cases":
    - heading "Your cases" [level=2]
    - text: 0 cases
    - alert:
      - text: Network error — could not reach http://localhost:3001. Is the API server running?
      - button "Retry"
    - text: Success is backed by recorded tests.
  - region "Report a bug":
    - text: START WITH THE BEHAVIOR
    - heading "Report a bug" [level=2]
    - paragraph: Describe what broke. Build a fix with evidence you can review.
    - text: Title *
    - textbox "Title *":
      - /placeholder: A brief, descriptive title
    - text: Description *
    - textbox "Description *":
      - /placeholder: What happened? Include any useful context.
    - text: Reproduction steps Optional
    - textbox "Reproduction steps Optional":
      - /placeholder: "1. Open the cart\n2. Add two products\n3. Check the total"
    - text: Expected behavior
    - textbox "Expected behavior":
      - /placeholder: What should happen?
    - text: Actual behavior
    - textbox "Actual behavior":
      - /placeholder: What happened instead?
    - button "Create case"
    - paragraph: A report starts the investigation. Recorded tests establish the result.
```

# Test source

```ts
  1  | 
  2  | import { test, expect } from "@playwright/test";
  3  | test.use({ viewport: { width: 1440, height: 1000 } });
  4  | 
  5  | test("desktop case workspace and report submission", async ({ page }, testInfo) => {
  6  |   const errors: string[] = [];
  7  |   page.on("pageerror", error => errors.push(error.message));
  8  |   await page.goto("/");
  9  |   await expect(page.getByRole("heading", { name: "Bug cases." })).toBeVisible();
  10 |   await expect(page.getByRole("table")).toBeVisible();
  11 |   const cases = await (await page.request.get("/api/cases")).json();
  12 |   expect(cases.length).toBeGreaterThan(0);
  13 |   await expect(page.locator(".case-title").first()).toBeVisible();
  14 |   const viewport = page.viewportSize()!;
  15 |   const table = await page.locator(".cases-panel").boundingBox();
  16 |   const form = await page.locator(".report-panel").boundingBox();
  17 |   expect(form!.x).toBeGreaterThan(table!.x + table!.width);
  18 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  19 |   await testInfo.attach("desktop-overview", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  20 | 
  21 |   await page.getByRole("button", { name: "Create case" }).click();
  22 |   await expect(page.getByRole("alert")).toHaveText("Title is required.");
  23 |   await expect(page.getByLabel("Title", { exact: false })).toBeFocused();
  24 |   await page.getByLabel("Title", { exact: false }).fill("UI smoke report");
  25 |   await page.getByRole("button", { name: "Create case" }).click();
  26 |   await expect(page.getByRole("alert")).toHaveText("Description is required.");
  27 |   await page.getByLabel("Description", { exact: false }).fill("Two products have an incorrect total.");
  28 |   await page.getByLabel("Reproduction steps").fill("Add two products.");
  29 |   await page.getByLabel("Expected behavior").fill("Sum both prices.");
  30 |   await page.getByLabel("Actual behavior").fill("Only the first price appears.");
  31 |   // Intercept submission to verify the payload without modifying real case data.
  32 |   let submitted: any;
  33 |   const created = { ...cases[0], id: "ui-smoke-created", title: "UI smoke report", description: "", status: "REPORTED", evidence: [], reproduction: null, patch: null, verification: null };
  34 |   await page.route("**/api/cases", async route => {
  35 |     if (route.request().method() !== "POST") return route.continue();
  36 |     submitted = route.request().postDataJSON();
  37 |     created.description = submitted.description;
  38 |     await route.fulfill({ json: created, status: 201 });
  39 |   });
  40 |   await page.route("**/api/cases/ui-smoke-created", route => route.fulfill({ json: created }));
  41 |   await page.route("**/api/ai/cases/ui-smoke-created/repair-runs", route => route.fulfill({ json: [] }));
  42 |   await page.getByRole("button", { name: "Create case" }).click();
  43 |   await expect(page).toHaveURL(/cases\/ui-smoke-created$/);
  44 |   await expect(page.getByRole("heading", { name: "UI smoke report", exact: true })).toBeVisible();
  45 |   expect(submitted.title).toBe("UI smoke report");
  46 |   expect(submitted.description).toContain("Steps to reproduce:\nAdd two products.");
  47 |   expect(submitted.description).toContain("Expected behavior:\nSum both prices.");
  48 |   expect(submitted.description).toContain("Actual behavior:\nOnly the first price appears.");
  49 |   await expect(page.getByText("Not run yet.", { exact: true })).toBeVisible();
  50 |   expect(errors).toEqual([]);
  51 | });
  52 | 
  53 | test("real case evidence on desktop and mobile", async ({ page }, testInfo) => {
  54 |   await page.goto("/");
> 55 |   await expect(page.getByRole("table")).toBeVisible();
     |                                         ^ Error: expect(locator).toBeVisible() failed
  56 |   const cases = await (await page.request.get("/api/cases")).json();
  57 |   const selected = cases.find((c: any) => c.evidence?.length) ?? cases[0];
  58 |   await page.goto("/cases/" + selected.id);
  59 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  60 |   await expect(page.getByRole("heading", { name: "Before / After Comparison", exact: true })).toBeVisible();
  61 |   await expect(page.getByRole("heading", { name: "Debugging & AI Repair Assistant", exact: true })).toBeVisible();
  62 |   await page.locator(".repair-assistant").getByText("Ask source code question", { exact: true }).waitFor();
  63 |   await page.waitForFunction(() => Array.from(document.images).every(img => img.complete));
  64 |   const evidence = await page.locator(".verification-overview").boundingBox();
  65 |   const assistant = await page.locator(".repair-assistant").boundingBox();
  66 |   expect(assistant!.x).toBeGreaterThan(evidence!.x + evidence!.width);
  67 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  68 |   await testInfo.attach("desktop-detail", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  69 |   await page.setViewportSize({ width: 390, height: 844 });
  70 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  71 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  72 |   const before = await page.locator(".comparison-card").first().boundingBox();
  73 |   const after = await page.locator(".comparison-card").last().boundingBox();
  74 |   expect(after!.y).toBeGreaterThan(before!.y);
  75 |   await testInfo.attach("mobile-detail", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  76 |   await page.goto("/");
  77 |   await expect(page.getByRole("table")).toBeVisible();
  78 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  79 |   await testInfo.attach("mobile-overview", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  80 | });
  81 | 
```