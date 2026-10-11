# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-smoke-3ee8fa62-482b-4bf8-aac0-696dfd2129ed.spec.ts >> real case evidence on desktop and mobile
- Location: tests\playwright\cases\ui-smoke-3ee8fa62-482b-4bf8-aac0-696dfd2129ed.spec.ts:60:5

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 390
Received:    494
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - link "Skip to content" [ref=f2e4] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=f2e5]:
    - link "Bug-to-Proof" [ref=f2e6] [cursor=pointer]:
      - /url: /
    - navigation "Main navigation" [ref=f2e11]:
      - link "Bug cases" [ref=f2e12] [cursor=pointer]:
        - /url: /
  - generic [ref=f2e15]:
    - banner [ref=f2e16]:
      - generic [ref=f2e17]: Engineering workspace
    - main [ref=f2e20]:
      - generic [ref=f2e21]:
        - generic [ref=f2e22]:
          - generic [ref=f2e23]:
            - generic [ref=f2e24]: FROM REPORT TO RESOLUTION
            - heading "Bug cases." [level=1] [ref=f2e25]
            - paragraph [ref=f2e26]: Reproduce the failure. Review the fix. Keep the proof.
          - link "Report a bug" [ref=f2e27] [cursor=pointer]:
            - /url: "#bug-title"
        - generic [ref=f2e30]:
          - generic [ref=f2e31]:
            - list "Repair workflow" [ref=f2e32]:
              - listitem [ref=f2e33]:
                - generic [ref=f2e34]: "1"
                - strong [ref=f2e36]: Report
              - listitem [ref=f2e37]:
                - generic [ref=f2e38]: "2"
                - strong [ref=f2e40]: Reproduce
              - listitem [ref=f2e41]:
                - generic [ref=f2e42]: "3"
                - strong [ref=f2e44]: Review patch
              - listitem [ref=f2e45]:
                - generic [ref=f2e46]: "4"
                - strong [ref=f2e48]: Verify
            - region [ref=f2e49]:
              - generic [ref=f2e50]:
                - heading "Your cases" [level=2] [ref=f2e51]
                - generic [ref=f2e52]: 7 cases
              - table [ref=f2e54]:
                - rowgroup [ref=f2e55]:
                  - row [ref=f2e56]:
                    - columnheader "Case" [ref=f2e57]
                    - columnheader "Status" [ref=f2e58]
                    - columnheader "Updated" [ref=f2e59]
                    - columnheader "Open case" [ref=f2e60]
                - rowgroup [ref=f2e62]:
                  - row [ref=f2e63]:
                    - cell [ref=f2e64]:
                      - link "Cart total only reflects first item price" [ref=f2e65] [cursor=pointer]:
                        - /url: /cases/case-001-cart-total
                      - paragraph [ref=f2e66]: When multiple items are added to the cart, the total displays only the first item price instead of the sum of all items.
                      - text: case-001-cart-total
                    - cell [ref=f2e67]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e68]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:29 PM" [ref=f2e69]:
                      - time [ref=f2e70]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e71]: 01:29 PM
                    - cell [ref=f2e72]:
                      - link "Open Cart total only reflects first item price" [ref=f2e73] [cursor=pointer]:
                        - /url: /cases/case-001-cart-total
                  - row [ref=f2e76]:
                    - cell [ref=f2e77]:
                      - link "MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE" [ref=f2e78] [cursor=pointer]:
                        - /url: /cases/case-001
                      - paragraph [ref=f2e79]: When two products are added to MiniShop's cart, the total shows only the first item's price instead of the sum of both. For example, adding Keyboard ($10) and Mouse Pad ($20) shows $10.00 instead of $30.00.
                      - text: case-001
                    - cell [ref=f2e80]:
                      - 'status "Status: VERIFIED" [ref=f2e81]': VERIFIED
                    - cell "Oct 8, 2026 11:53 PM" [ref=f2e82]:
                      - time [ref=f2e83]:
                        - text: Oct 8, 2026
                        - generic [ref=f2e84]: 11:53 PM
                    - cell [ref=f2e85]:
                      - link "Open MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE" [ref=f2e86] [cursor=pointer]:
                        - /url: /cases/case-001
                  - row [ref=f2e89]:
                    - cell [ref=f2e90]:
                      - link "Adding an existing item does not increment its quantity" [ref=f2e91] [cursor=pointer]:
                        - /url: /cases/case-002-repeated-item-qty
                      - paragraph [ref=f2e92]: Adding the same product multiple times leaves the quantity at 1 instead of incrementing it.
                      - text: case-002-repeated-item-qty
                    - cell [ref=f2e93]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e94]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:30 PM" [ref=f2e95]:
                      - time [ref=f2e96]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e97]: 01:30 PM
                    - cell [ref=f2e98]:
                      - link "Open Adding an existing item does not increment its quantity" [ref=f2e99] [cursor=pointer]:
                        - /url: /cases/case-002-repeated-item-qty
                  - row [ref=f2e102]:
                    - cell [ref=f2e103]:
                      - link "Removing an item retains the item or clears entire cart" [ref=f2e104] [cursor=pointer]:
                        - /url: /cases/case-003-item-removal
                      - paragraph [ref=f2e105]: Calling removeItem with a productId fails to filter out the target product correctly.
                      - text: case-003-item-removal
                    - cell [ref=f2e106]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e107]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:30 PM" [ref=f2e108]:
                      - time [ref=f2e109]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e110]: 01:30 PM
                    - cell [ref=f2e111]:
                      - link "Open Removing an item retains the item or clears entire cart" [ref=f2e112] [cursor=pointer]:
                        - /url: /cases/case-003-item-removal
                  - row [ref=f2e115]:
                    - cell [ref=f2e116]:
                      - link "Clear cart leaves items in state" [ref=f2e117] [cursor=pointer]:
                        - /url: /cases/case-004-cart-clear
                      - paragraph [ref=f2e118]: Calling clearCart does not empty the items array completely.
                      - text: case-004-cart-clear
                    - cell [ref=f2e119]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e120]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:11 PM" [ref=f2e121]:
                      - time [ref=f2e122]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e123]: 06:11 PM
                    - cell [ref=f2e124]:
                      - link "Open Clear cart leaves items in state" [ref=f2e125] [cursor=pointer]:
                        - /url: /cases/case-004-cart-clear
                  - row [ref=f2e128]:
                    - cell [ref=f2e129]:
                      - link "Cart total calculation ignores item quantities" [ref=f2e130] [cursor=pointer]:
                        - /url: /cases/case-005-cart-total-quantities
                      - paragraph [ref=f2e131]: When items have quantity > 1, the total sums item prices without multiplying by quantity.
                      - text: case-005-cart-total-quantities
                    - cell [ref=f2e132]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e133]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:12 PM" [ref=f2e134]:
                      - time [ref=f2e135]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e136]: 06:12 PM
                    - cell [ref=f2e137]:
                      - link "Open Cart total calculation ignores item quantities" [ref=f2e138] [cursor=pointer]:
                        - /url: /cases/case-005-cart-total-quantities
                  - row [ref=f2e141]:
                    - cell [ref=f2e142]:
                      - link "Async promo code application race condition drops concurrent cart updates" [ref=f2e143] [cursor=pointer]:
                        - /url: /cases/case-007-promo-discount
                      - paragraph [ref=f2e144]: When an item is added while asynchronous promo code validation is in flight, the promo resolution overwrites cart items with a stale pre-await snapshot, dropping newly added items.
                      - text: case-007-promo-discount
                    - cell [ref=f2e145]:
                      - 'status "Status: READY TO REPRODUCE" [ref=f2e146]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:12 PM" [ref=f2e147]:
                      - time [ref=f2e148]:
                        - text: Oct 9, 2026
                        - generic [ref=f2e149]: 06:12 PM
                    - cell [ref=f2e150]:
                      - link "Open Async promo code application race condition drops concurrent cart updates" [ref=f2e151] [cursor=pointer]:
                        - /url: /cases/case-007-promo-discount
              - generic [ref=f2e154]: Success is backed by recorded tests.
          - region [ref=f2e158]:
            - generic [ref=f2e159]: START WITH THE BEHAVIOR
            - heading "Report a bug" [level=2] [ref=f2e160]
            - paragraph [ref=f2e161]: Describe what broke. Build a fix with evidence you can review.
            - generic [ref=f2e162]:
              - generic [ref=f2e163]: Title *
              - textbox "Title *" [ref=f2e164]:
                - /placeholder: A brief, descriptive title
              - generic [ref=f2e165]: Description *
              - textbox "Description *" [ref=f2e166]:
                - /placeholder: What happened? Include any useful context.
              - generic [ref=f2e167]:
                - text: Reproduction steps
                - generic [ref=f2e168]: Optional
              - textbox "Reproduction steps Optional" [ref=f2e169]:
                - /placeholder: "1. Open the cart\n2. Add two products\n3. Check the total"
              - generic [ref=f2e170]:
                - generic [ref=f2e171]:
                  - generic [ref=f2e172]: Expected behavior
                  - textbox "Expected behavior" [ref=f2e173]:
                    - /placeholder: What should happen?
                - generic [ref=f2e174]:
                  - generic [ref=f2e175]: Actual behavior
                  - textbox "Actual behavior" [ref=f2e176]:
                    - /placeholder: What happened instead?
              - button "Create case" [ref=f2e177] [cursor=pointer]
              - paragraph [ref=f2e180]: A report starts the investigation. Recorded tests establish the result.
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
  18 |   const cases = await (await page.request.get("/api/cases")).json();
  19 |   expect(cases.length).toBeGreaterThan(0);
  20 |   await expect(page.locator(".case-title").first()).toBeVisible();
  21 |   const viewport = page.viewportSize()!;
  22 |   const table = await page.locator(".cases-panel").boundingBox();
  23 |   const form = await page.locator(".report-panel").boundingBox();
  24 |   expect(form!.x).toBeGreaterThan(table!.x + table!.width);
  25 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  26 |   await capture(page, testInfo, "desktop-overview");
  27 | 
  28 |   await page.getByRole("button", { name: "Create case" }).click();
  29 |   await expect(page.getByRole("alert")).toHaveText("Title is required.");
  30 |   await expect(page.getByRole("textbox", { name: "Title *", exact: true })).toBeFocused();
  31 |   await page.getByRole("textbox", { name: "Title *", exact: true }).fill("UI smoke report");
  32 |   await page.getByRole("button", { name: "Create case" }).click();
  33 |   await expect(page.getByRole("alert")).toHaveText("Description is required.");
  34 |   await page.getByLabel("Description", { exact: false }).fill("Two products have an incorrect total.");
  35 |   await page.getByLabel("Reproduction steps").fill("Add two products.");
  36 |   await page.getByLabel("Expected behavior").fill("Sum both prices.");
  37 |   await page.getByLabel("Actual behavior").fill("Only the first price appears.");
  38 |   // Intercept submission to verify the payload without modifying real case data.
  39 |   let submitted: any;
  40 |   const created = { ...cases[0], id: "ui-smoke-created", title: "UI smoke report", description: "", status: "REPORTED", evidence: [], reproduction: null, patch: null, verification: null };
  41 |   await page.route("**/api/cases", async route => {
  42 |     if (route.request().method() !== "POST") return route.continue();
  43 |     submitted = route.request().postDataJSON();
  44 |     created.description = submitted.description;
  45 |     await route.fulfill({ json: created, status: 201 });
  46 |   });
  47 |   await page.route("**/api/cases/ui-smoke-created", route => route.fulfill({ json: created }));
  48 |   await page.route("**/api/ai/cases/ui-smoke-created/repair-runs", route => route.fulfill({ json: [] }));
  49 |   await page.getByRole("button", { name: "Create case" }).click();
  50 |   await expect(page).toHaveURL(/cases\/ui-smoke-created$/);
  51 |   await expect(page.getByRole("heading", { name: "UI smoke report", exact: true })).toBeVisible();
  52 |   expect(submitted.title).toBe("UI smoke report");
  53 |   expect(submitted.description).toContain("Steps to reproduce:\nAdd two products.");
  54 |   expect(submitted.description).toContain("Expected behavior:\nSum both prices.");
  55 |   expect(submitted.description).toContain("Actual behavior:\nOnly the first price appears.");
  56 |   await expect(page.getByText("Not run yet.", { exact: true })).toBeVisible();
  57 |   expect(errors).toEqual([]);
  58 | });
  59 | 
  60 | test("real case evidence on desktop and mobile", async ({ page }, testInfo) => {
  61 |   await page.goto("/");
  62 |   await expect(page.getByRole("table")).toBeVisible();
  63 |   const cases = await (await page.request.get("/api/cases")).json();
  64 |   const selected = cases.find((c: any) => c.evidence?.length) ?? cases[0];
  65 |   await page.goto("/cases/" + selected.id);
  66 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  67 |   await expect(page.getByRole("heading", { name: "Before / After Comparison", exact: true })).toBeVisible();
  68 |   await expect(page.getByRole("heading", { name: "Debugging & AI Repair Assistant", exact: true })).toBeVisible();
  69 |   await page.locator(".repair-assistant").getByText("Ask source code question", { exact: true }).waitFor();
  70 |   await page.waitForFunction(() => Array.from(document.images).every(img => img.complete));
  71 |   const evidence = await page.locator(".verification-overview").boundingBox();
  72 |   const assistant = await page.locator(".repair-assistant").boundingBox();
  73 |   expect(assistant!.x).toBeGreaterThan(evidence!.x + evidence!.width);
  74 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  75 |   await capture(page, testInfo, "desktop-detail");
  76 |   await page.setViewportSize({ width: 390, height: 844 });
  77 |   await expect(page.getByRole("heading", { name: selected.title, exact: true })).toBeVisible();
  78 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  79 |   const before = await page.locator(".comparison-card").first().boundingBox();
  80 |   const after = await page.locator(".comparison-card").last().boundingBox();
  81 |   expect(after!.y).toBeGreaterThan(before!.y);
  82 |   await capture(page, testInfo, "mobile-detail");
  83 |   await page.goto("/");
  84 |   await expect(page.getByRole("table")).toBeVisible();
> 85 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
     |                                                                           ^ Error: expect(received).toBeLessThanOrEqual(expected)
  86 |   await capture(page, testInfo, "mobile-overview");
  87 | });
  88 | 
```