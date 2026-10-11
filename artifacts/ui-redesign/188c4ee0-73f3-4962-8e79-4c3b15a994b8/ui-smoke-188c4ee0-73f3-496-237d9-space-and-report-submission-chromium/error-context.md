# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-smoke-188c4ee0-73f3-4962-8e79-4c3b15a994b8.spec.ts >> desktop case workspace and report submission
- Location: tests\playwright\cases\ui-smoke-188c4ee0-73f3-4962-8e79-4c3b15a994b8.spec.ts:5:5

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator: getByLabel('Title')
Expected: focused
Error: strict mode violation: getByLabel('Title') resolved to 2 elements:
    1) <a class="case-open" href="/cases/case-001" aria-label="Open MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE">…</a> aka getByRole('link', { name: 'Open MUTATED LIVE CASE TITLE' })
    2) <input value="" id="bug-title" aria-required="true" placeholder="A brief, descriptive title"/> aka getByRole('textbox', { name: 'Title *' })

Call log:
  - Expect "toBeFocused" getByLabel('Title') with timeout 5000ms
  - waiting for getByLabel('Title')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to content" [ref=e4] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=e5]:
    - link "Bug-to-Proof" [ref=e6] [cursor=pointer]:
      - /url: /
    - generic [ref=e11]: WORKSPACE
    - navigation "Main navigation" [ref=e12]:
      - link "Bug cases" [ref=e13] [cursor=pointer]:
        - /url: /
    - generic [ref=e18]:
      - text: THE WORKFLOW
      - paragraph [ref=e19]: Every fix startswith a proven failure.
      - list [ref=e20]:
        - listitem [ref=e21]: Report the behavior
        - listitem [ref=e22]: Reproduce the failure
        - listitem [ref=e23]: Review the patch
        - listitem [ref=e24]: Verify with evidence
    - generic [ref=e27]:
      - strong [ref=e28]: Local workspace
      - generic [ref=e29]: Evidence-backed repair
  - generic [ref=e30]:
    - banner [ref=e31]:
      - generic [ref=e32]: Engineering workspace
      - generic [ref=e35]: Proof over promises
    - main [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e41]:
            - generic [ref=e42]: FROM REPORT TO RESOLUTION
            - heading "Bug cases." [level=1] [ref=e43]
            - paragraph [ref=e44]: Reproduce the failure. Review the fix. Keep the proof.
          - link "Report a bug" [ref=e45] [cursor=pointer]:
            - /url: "#bug-title"
        - generic [ref=e48]:
          - generic [ref=e49]:
            - list "Repair workflow" [ref=e50]:
              - listitem [ref=e51]:
                - generic [ref=e52]: "1"
                - generic [ref=e53]:
                  - strong [ref=e54]: Report
                  - generic [ref=e55]: Describe the issue
                - generic [aria-hidden] [ref=e56]: →
              - listitem [ref=e57]:
                - generic [ref=e58]: "2"
                - generic [ref=e59]:
                  - strong [ref=e60]: Reproduce
                  - generic [ref=e61]: Confirm the behavior
                - generic [aria-hidden] [ref=e62]: →
              - listitem [ref=e63]:
                - generic [ref=e64]: "3"
                - generic [ref=e65]:
                  - strong [ref=e66]: Review patch
                  - generic [ref=e67]: Assess the proposed fix
                - generic [aria-hidden] [ref=e68]: →
              - listitem [ref=e69]:
                - generic [ref=e70]: "4"
                - generic [ref=e71]:
                  - strong [ref=e72]: Verify
                  - generic [ref=e73]: Run tests and checks
            - region [ref=e74]:
              - generic [ref=e75]:
                - heading "Your cases" [level=2] [ref=e76]
                - generic [ref=e77]: 7 cases
              - table [ref=e79]:
                - rowgroup [ref=e80]:
                  - row [ref=e81]:
                    - columnheader "Case" [ref=e82]
                    - columnheader "Status" [ref=e83]
                    - columnheader "Updated" [ref=e84]
                    - columnheader "Open case" [ref=e85]
                - rowgroup [ref=e87]:
                  - row [ref=e88]:
                    - cell [ref=e89]:
                      - link "Cart total only reflects first item price" [ref=e90] [cursor=pointer]:
                        - /url: /cases/case-001-cart-total
                      - paragraph [ref=e91]: When multiple items are added to the cart, the total displays only the first item price instead of the sum of all items.
                      - text: case-001-cart-total
                    - cell [ref=e92]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e93]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:29 PM" [ref=e94]:
                      - time [ref=e95]:
                        - text: Oct 9, 2026
                        - generic [ref=e96]: 01:29 PM
                    - cell [ref=e97]:
                      - link "Open Cart total only reflects first item price" [ref=e98] [cursor=pointer]:
                        - /url: /cases/case-001-cart-total
                  - row [ref=e101]:
                    - cell [ref=e102]:
                      - link "MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE" [ref=e103] [cursor=pointer]:
                        - /url: /cases/case-001
                      - paragraph [ref=e104]: When two products are added to MiniShop's cart, the total shows only the first item's price instead of the sum of both. For example, adding Keyboard ($10) and Mouse Pad ($20) shows $10.00 instead of $30.00.
                      - text: case-001
                    - cell [ref=e105]:
                      - 'status "Status: VERIFIED" [ref=e106]': VERIFIED
                    - cell "Oct 8, 2026 11:53 PM" [ref=e107]:
                      - time [ref=e108]:
                        - text: Oct 8, 2026
                        - generic [ref=e109]: 11:53 PM
                    - cell [ref=e110]:
                      - link "Open MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE" [ref=e111] [cursor=pointer]:
                        - /url: /cases/case-001
                  - row [ref=e114]:
                    - cell [ref=e115]:
                      - link "Adding an existing item does not increment its quantity" [ref=e116] [cursor=pointer]:
                        - /url: /cases/case-002-repeated-item-qty
                      - paragraph [ref=e117]: Adding the same product multiple times leaves the quantity at 1 instead of incrementing it.
                      - text: case-002-repeated-item-qty
                    - cell [ref=e118]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e119]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:30 PM" [ref=e120]:
                      - time [ref=e121]:
                        - text: Oct 9, 2026
                        - generic [ref=e122]: 01:30 PM
                    - cell [ref=e123]:
                      - link "Open Adding an existing item does not increment its quantity" [ref=e124] [cursor=pointer]:
                        - /url: /cases/case-002-repeated-item-qty
                  - row [ref=e127]:
                    - cell [ref=e128]:
                      - link "Removing an item retains the item or clears entire cart" [ref=e129] [cursor=pointer]:
                        - /url: /cases/case-003-item-removal
                      - paragraph [ref=e130]: Calling removeItem with a productId fails to filter out the target product correctly.
                      - text: case-003-item-removal
                    - cell [ref=e131]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e132]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 01:30 PM" [ref=e133]:
                      - time [ref=e134]:
                        - text: Oct 9, 2026
                        - generic [ref=e135]: 01:30 PM
                    - cell [ref=e136]:
                      - link "Open Removing an item retains the item or clears entire cart" [ref=e137] [cursor=pointer]:
                        - /url: /cases/case-003-item-removal
                  - row [ref=e140]:
                    - cell [ref=e141]:
                      - link "Clear cart leaves items in state" [ref=e142] [cursor=pointer]:
                        - /url: /cases/case-004-cart-clear
                      - paragraph [ref=e143]: Calling clearCart does not empty the items array completely.
                      - text: case-004-cart-clear
                    - cell [ref=e144]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e145]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:11 PM" [ref=e146]:
                      - time [ref=e147]:
                        - text: Oct 9, 2026
                        - generic [ref=e148]: 06:11 PM
                    - cell [ref=e149]:
                      - link "Open Clear cart leaves items in state" [ref=e150] [cursor=pointer]:
                        - /url: /cases/case-004-cart-clear
                  - row [ref=e153]:
                    - cell [ref=e154]:
                      - link "Cart total calculation ignores item quantities" [ref=e155] [cursor=pointer]:
                        - /url: /cases/case-005-cart-total-quantities
                      - paragraph [ref=e156]: When items have quantity > 1, the total sums item prices without multiplying by quantity.
                      - text: case-005-cart-total-quantities
                    - cell [ref=e157]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e158]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:12 PM" [ref=e159]:
                      - time [ref=e160]:
                        - text: Oct 9, 2026
                        - generic [ref=e161]: 06:12 PM
                    - cell [ref=e162]:
                      - link "Open Cart total calculation ignores item quantities" [ref=e163] [cursor=pointer]:
                        - /url: /cases/case-005-cart-total-quantities
                  - row [ref=e166]:
                    - cell [ref=e167]:
                      - link "Async promo code application race condition drops concurrent cart updates" [ref=e168] [cursor=pointer]:
                        - /url: /cases/case-007-promo-discount
                      - paragraph [ref=e169]: When an item is added while asynchronous promo code validation is in flight, the promo resolution overwrites cart items with a stale pre-await snapshot, dropping newly added items.
                      - text: case-007-promo-discount
                    - cell [ref=e170]:
                      - 'status "Status: READY TO REPRODUCE" [ref=e171]': READY TO REPRODUCE
                    - cell "Oct 9, 2026 06:12 PM" [ref=e172]:
                      - time [ref=e173]:
                        - text: Oct 9, 2026
                        - generic [ref=e174]: 06:12 PM
                    - cell [ref=e175]:
                      - link "Open Async promo code application race condition drops concurrent cart updates" [ref=e176] [cursor=pointer]:
                        - /url: /cases/case-007-promo-discount
              - generic [ref=e179]: Success is backed by recorded tests.
          - region [ref=e183]:
            - generic [ref=e184]: START WITH THE BEHAVIOR
            - heading "Report a bug" [level=2] [ref=e185]
            - paragraph [ref=e186]: Describe what broke. Build a fix with evidence you can review.
            - generic [ref=e187]:
              - alert [ref=e188]: Title is required.
              - generic [ref=e189]: Title *
              - textbox "Title *" [active] [ref=e190]:
                - /placeholder: A brief, descriptive title
              - generic [ref=e191]: Description *
              - textbox "Description *" [ref=e192]:
                - /placeholder: What happened? Include any useful context.
              - generic [ref=e193]:
                - text: Reproduction steps
                - generic [ref=e194]: Optional
              - textbox "Reproduction steps Optional" [ref=e195]:
                - /placeholder: "1. Open the cart\n2. Add two products\n3. Check the total"
              - generic [ref=e196]:
                - generic [ref=e197]:
                  - generic [ref=e198]: Expected behavior
                  - textbox "Expected behavior" [ref=e199]:
                    - /placeholder: What should happen?
                - generic [ref=e200]:
                  - generic [ref=e201]: Actual behavior
                  - textbox "Actual behavior" [ref=e202]:
                    - /placeholder: What happened instead?
              - button "Create case" [ref=e203] [cursor=pointer]
              - paragraph [ref=e206]: A report starts the investigation. Recorded tests establish the result.
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
> 23 |   await expect(page.getByLabel("Title", { exact: false })).toBeFocused();
     |                                                            ^ Error: expect(locator).toBeFocused() failed
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
  55 |   await expect(page.getByRole("table")).toBeVisible();
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