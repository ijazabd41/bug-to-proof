# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-smoke-1b44fe3d-0cf9-4f7e-aec0-0090906eee7a.spec.ts >> real case evidence on desktop and mobile
- Location: tests\playwright\cases\ui-smoke-1b44fe3d-0cf9-4f7e-aec0-0090906eee7a.spec.ts:66:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('.case-card').first()
Expected: visible
Received: hidden
Timeout:  15000ms

Call log:
  - Expect "toBeVisible" locator('.case-card').first() with timeout 15000ms
  - waiting for locator('.case-card').first()
    32 × locator resolved to <a class="case-card" href="/cases/case-001-cart-total">…</a>
       - unexpected value "hidden"

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
    - text: 7 of 7
    - search:
      - text: Search cases
      - searchbox "Search cases"
      - text: Filter by status
      - combobox "Filter by status":
        - option "All statuses" [selected]
        - option "READY TO REPRODUCE"
        - option "VERIFIED"
    - table:
      - rowgroup:
        - row "Case Status Updated Open case":
          - columnheader "Case"
          - columnheader "Status"
          - columnheader "Updated"
          - columnheader "Open case"
      - rowgroup:
        - 'row "Cart total only reflects first item price When multiple items are added to the cart, the total displays only the first item price instead of the sum of all items. case-001-cart-total Status: READY TO REPRODUCE Oct 9, 2026 01:29 PM Open Cart total only reflects first item price"':
          - cell "Cart total only reflects first item price When multiple items are added to the cart, the total displays only the first item price instead of the sum of all items. case-001-cart-total":
            - link "Cart total only reflects first item price":
              - /url: /cases/case-001-cart-total
            - paragraph: When multiple items are added to the cart, the total displays only the first item price instead of the sum of all items.
            - text: case-001-cart-total
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 01:29 PM":
            - time: Oct 9, 2026 01:29 PM
          - cell "Open Cart total only reflects first item price":
            - link "Open Cart total only reflects first item price":
              - /url: /cases/case-001-cart-total
        - 'row "Cart total only reflects first item price When two products are added to MiniShop''s cart, the total shows only the first item''s price instead of the sum of both. For example, adding Keyboard ($10) and Mouse Pad ($20) shows $10.00 instead of $30.00. case-001 Status: VERIFIED Oct 8, 2026 11:53 PM Open Cart total only reflects first item price"':
          - cell "Cart total only reflects first item price When two products are added to MiniShop's cart, the total shows only the first item's price instead of the sum of both. For example, adding Keyboard ($10) and Mouse Pad ($20) shows $10.00 instead of $30.00. case-001":
            - link "Cart total only reflects first item price":
              - /url: /cases/case-001
            - paragraph: When two products are added to MiniShop's cart, the total shows only the first item's price instead of the sum of both. For example, adding Keyboard ($10) and Mouse Pad ($20) shows $10.00 instead of $30.00.
            - text: case-001
          - 'cell "Status: VERIFIED"':
            - 'status "Status: VERIFIED"': VERIFIED
          - cell "Oct 8, 2026 11:53 PM":
            - time: Oct 8, 2026 11:53 PM
          - cell "Open Cart total only reflects first item price":
            - link "Open Cart total only reflects first item price":
              - /url: /cases/case-001
        - 'row "Adding an existing item does not increment its quantity Adding the same product multiple times leaves the quantity at 1 instead of incrementing it. case-002-repeated-item-qty Status: READY TO REPRODUCE Oct 9, 2026 01:30 PM Open Adding an existing item does not increment its quantity"':
          - cell "Adding an existing item does not increment its quantity Adding the same product multiple times leaves the quantity at 1 instead of incrementing it. case-002-repeated-item-qty":
            - link "Adding an existing item does not increment its quantity":
              - /url: /cases/case-002-repeated-item-qty
            - paragraph: Adding the same product multiple times leaves the quantity at 1 instead of incrementing it.
            - text: case-002-repeated-item-qty
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 01:30 PM":
            - time: Oct 9, 2026 01:30 PM
          - cell "Open Adding an existing item does not increment its quantity":
            - link "Open Adding an existing item does not increment its quantity":
              - /url: /cases/case-002-repeated-item-qty
        - 'row "Removing an item retains the item or clears entire cart Calling removeItem with a productId fails to filter out the target product correctly. case-003-item-removal Status: READY TO REPRODUCE Oct 9, 2026 01:30 PM Open Removing an item retains the item or clears entire cart"':
          - cell "Removing an item retains the item or clears entire cart Calling removeItem with a productId fails to filter out the target product correctly. case-003-item-removal":
            - link "Removing an item retains the item or clears entire cart":
              - /url: /cases/case-003-item-removal
            - paragraph: Calling removeItem with a productId fails to filter out the target product correctly.
            - text: case-003-item-removal
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 01:30 PM":
            - time: Oct 9, 2026 01:30 PM
          - cell "Open Removing an item retains the item or clears entire cart":
            - link "Open Removing an item retains the item or clears entire cart":
              - /url: /cases/case-003-item-removal
        - 'row "Clear cart leaves items in state Calling clearCart does not empty the items array completely. case-004-cart-clear Status: READY TO REPRODUCE Oct 9, 2026 06:11 PM Open Clear cart leaves items in state"':
          - cell "Clear cart leaves items in state Calling clearCart does not empty the items array completely. case-004-cart-clear":
            - link "Clear cart leaves items in state":
              - /url: /cases/case-004-cart-clear
            - paragraph: Calling clearCart does not empty the items array completely.
            - text: case-004-cart-clear
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 06:11 PM":
            - time: Oct 9, 2026 06:11 PM
          - cell "Open Clear cart leaves items in state":
            - link "Open Clear cart leaves items in state":
              - /url: /cases/case-004-cart-clear
        - 'row "Cart total calculation ignores item quantities When items have quantity > 1, the total sums item prices without multiplying by quantity. case-005-cart-total-quantities Status: READY TO REPRODUCE Oct 9, 2026 06:12 PM Open Cart total calculation ignores item quantities"':
          - cell "Cart total calculation ignores item quantities When items have quantity > 1, the total sums item prices without multiplying by quantity. case-005-cart-total-quantities":
            - link "Cart total calculation ignores item quantities":
              - /url: /cases/case-005-cart-total-quantities
            - paragraph: When items have quantity > 1, the total sums item prices without multiplying by quantity.
            - text: case-005-cart-total-quantities
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 06:12 PM":
            - time: Oct 9, 2026 06:12 PM
          - cell "Open Cart total calculation ignores item quantities":
            - link "Open Cart total calculation ignores item quantities":
              - /url: /cases/case-005-cart-total-quantities
        - 'row "Async promo code application race condition drops concurrent cart updates When an item is added while asynchronous promo code validation is in flight, the promo resolution overwrites cart items with a stale pre-await snapshot, dropping newly added items. case-007-promo-discount Status: READY TO REPRODUCE Oct 9, 2026 06:12 PM Open Async promo code application race condition drops concurrent cart updates"':
          - cell "Async promo code application race condition drops concurrent cart updates When an item is added while asynchronous promo code validation is in flight, the promo resolution overwrites cart items with a stale pre-await snapshot, dropping newly added items. case-007-promo-discount":
            - link "Async promo code application race condition drops concurrent cart updates":
              - /url: /cases/case-007-promo-discount
            - paragraph: When an item is added while asynchronous promo code validation is in flight, the promo resolution overwrites cart items with a stale pre-await snapshot, dropping newly added items.
            - text: case-007-promo-discount
          - 'cell "Status: READY TO REPRODUCE"':
            - 'status "Status: READY TO REPRODUCE"': READY TO REPRODUCE
          - cell "Oct 9, 2026 06:12 PM":
            - time: Oct 9, 2026 06:12 PM
          - cell "Open Async promo code application race condition drops concurrent cart updates":
            - link "Open Async promo code application race condition drops concurrent cart updates":
              - /url: /cases/case-007-promo-discount
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
  2  | import { test, expect as baseExpect } from "@playwright/test";
  3  | const expect = baseExpect.configure({ timeout: 15_000 });
  4  | test.setTimeout(90_000);
  5  | test.use({ viewport: { width: 1440, height: 1000 } });
  6  | async function capture(page: any, testInfo: any, name: string) {
  7  |   const file = testInfo.outputPath(name + ".png");
  8  |   await page.screenshot({ path: file, fullPage: true });
  9  |   await testInfo.attach(name, { path: file, contentType: "image/png" });
  10 | }
  11 | 
  12 | test("desktop case workspace and report submission", async ({ page }, testInfo) => {
  13 |   const errors: string[] = [];
  14 |   page.on("pageerror", error => errors.push(error.message));
  15 |   await page.goto("/");
  16 |   await expect(page.getByRole("heading", { name: "Bug cases." })).toBeVisible();
  17 |   await expect(page.getByRole("table")).toBeVisible();
  18 |   await page.getByRole("searchbox", { name: "Search cases" }).fill("quantity");
  19 |   await expect(page.locator(".case-title")).toHaveCount(2);
  20 |   await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  21 |   await page.getByRole("combobox", { name: "Filter by status" }).selectOption("VERIFIED");
  22 |   await expect(page.locator(".case-title")).toHaveCount(1);
  23 |   await page.getByRole("button", { name: "Clear" }).click();
  24 |   const cases = await (await page.request.get("/api/cases")).json();
  25 |   expect(cases.length).toBeGreaterThan(0);
  26 |   await expect(page.locator(".case-title").first()).toBeVisible();
  27 |   const viewport = page.viewportSize()!;
  28 |   const table = await page.locator(".cases-panel").boundingBox();
  29 |   const form = await page.locator(".report-panel").boundingBox();
  30 |   expect(form!.x).toBeGreaterThan(table!.x + table!.width);
  31 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  32 |   await capture(page, testInfo, "desktop-overview");
  33 | 
  34 |   await page.getByRole("button", { name: "Create case" }).click();
  35 |   await expect(page.getByRole("alert")).toHaveText("Title is required.");
  36 |   await expect(page.getByRole("textbox", { name: "Title *", exact: true })).toBeFocused();
  37 |   await page.getByRole("textbox", { name: "Title *", exact: true }).fill("UI smoke report");
  38 |   await page.getByRole("button", { name: "Create case" }).click();
  39 |   await expect(page.getByRole("alert")).toHaveText("Description is required.");
  40 |   await page.getByLabel("Description", { exact: false }).fill("Two products have an incorrect total.");
  41 |   await page.getByLabel("Reproduction steps").fill("Add two products.");
  42 |   await page.getByLabel("Expected behavior").fill("Sum both prices.");
  43 |   await page.getByLabel("Actual behavior").fill("Only the first price appears.");
  44 |   // Intercept submission to verify the payload without modifying real case data.
  45 |   let submitted: any;
  46 |   const created = { ...cases[0], id: "ui-smoke-created", title: "UI smoke report", description: "", status: "REPORTED", evidence: [], reproduction: null, patch: null, verification: null };
  47 |   await page.route("**/api/cases", async route => {
  48 |     if (route.request().method() !== "POST") return route.continue();
  49 |     submitted = route.request().postDataJSON();
  50 |     created.description = submitted.description;
  51 |     await route.fulfill({ json: created, status: 201 });
  52 |   });
  53 |   await page.route("**/api/cases/ui-smoke-created", route => route.fulfill({ json: created }));
  54 |   await page.route("**/api/ai/cases/ui-smoke-created/repair-runs", route => route.fulfill({ json: [] }));
  55 |   await page.getByRole("button", { name: "Create case" }).click();
  56 |   await expect(page).toHaveURL(/cases\/ui-smoke-created$/);
  57 |   await expect(page.getByRole("heading", { name: "UI smoke report", exact: true })).toBeVisible();
  58 |   expect(submitted.title).toBe("UI smoke report");
  59 |   expect(submitted.description).toContain("Steps to reproduce:\nAdd two products.");
  60 |   expect(submitted.description).toContain("Expected behavior:\nSum both prices.");
  61 |   expect(submitted.description).toContain("Actual behavior:\nOnly the first price appears.");
  62 |   await expect(page.getByText("Not run yet.", { exact: true })).toBeVisible();
  63 |   expect(errors).toEqual([]);
  64 | });
  65 | 
  66 | test("real case evidence on desktop and mobile", async ({ page }, testInfo) => {
  67 |   await page.goto("/");
> 68 |   await expect(page.locator(".case-card").first()).toBeVisible();
     |                                                    ^ Error: expect(locator).toBeVisible() failed
  69 |   await expect(page.getByRole("table")).toBeHidden();
  70 |   const cases = await (await page.request.get("/api/cases")).json();
  71 |   const selected = cases.find((c: any) => c.evidence?.length) ?? cases[0];
  72 |   await page.goto("/cases/" + selected.id);
  73 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  74 |   await expect(page.getByRole("heading", { name: "Before / After Comparison", exact: true })).toBeVisible();
  75 |   await expect(page.getByRole("heading", { name: "Debugging & AI Repair Assistant", exact: true })).toBeVisible();
  76 |   await page.locator(".repair-assistant").getByText("Ask source code question", { exact: true }).waitFor();
  77 |   await page.waitForFunction(() => Array.from(document.images).every(img => img.complete));
  78 |   const evidence = await page.locator(".verification-overview").boundingBox();
  79 |   const assistant = await page.locator(".repair-assistant").boundingBox();
  80 |   expect(assistant!.x).toBeGreaterThan(evidence!.x + evidence!.width);
  81 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  82 |   await capture(page, testInfo, "desktop-detail");
  83 |   await page.setViewportSize({ width: 390, height: 844 });
  84 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  85 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  86 |   const before = await page.locator(".comparison-card").first().boundingBox();
  87 |   const after = await page.locator(".comparison-card").last().boundingBox();
  88 |   expect(after!.y).toBeGreaterThan(before!.y);
  89 |   await capture(page, testInfo, "mobile-detail");
  90 |   await page.goto("/");
  91 |   await expect(page.getByRole("table")).toBeVisible();
  92 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  93 |   await capture(page, testInfo, "mobile-overview");
  94 | });
  95 | 
```