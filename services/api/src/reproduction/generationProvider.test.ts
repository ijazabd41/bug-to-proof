import { describe, expect, it } from "vitest";
import { buildReproductionPrompt } from "./generationProvider";

describe("reproduction generation prompt", () => {
  it("supplies the strict data-only schema shapes without repository artifacts", () => {
    const prompt = buildReproductionPrompt({
      promptVersion: "reproduction-v2",
      report: { title: "Cart route", description: "Cart link stays on shop" },
      discovery: {
        schemaVersion: "1.0",
        sourceFingerprint: "source",
        inventoryDigest: "inventory",
        routes: ["/", "/cart"],
        controls: [{ role: "link", name: "Cart", sourcePath: "src/App.tsx" }],
        targets: [{ testId: "cart-total", sourcePath: "src/Cart.tsx" }],
        headings: [{ level: 2, text: "Your Cart", sourcePath: "src/pages/CartPage.tsx" }],
        fixtures: { products: [{ id: 1, name: "Keyboard", price: 10 }] },
        sourceFiles: [],
        capturedAt: "2026-10-13T00:00:00.000Z",
      },
      attempt: 1,
      previousDiagnostics: [],
    });

    expect(prompt).toContain('"requiredKeys":["schemaVersion","title","startPath","preconditions","steps","assertion","rationale","reportMapping"]');
    expect(prompt).toContain('"type":"urlPathEquals"');
    expect(prompt).toContain('"reportFact":"verbatim report fact"');
    expect(prompt).toContain('"testId":"cart-total"');
    expect(prompt).toContain('"type":"targetCurrencyEquals"');
    expect(prompt).toContain('"type":"targetCurrencySumEquals"');
    expect(prompt).toContain("relational currency expectation");
    expect(prompt).toContain('"type":"fillTarget"');
    expect(prompt).toContain("assertion must be exactly one object");
    expect(prompt).toContain("Hard navigation after an interactive state change can discard the in-memory cart");
    expect(prompt).toContain("targetVisibilityEquals for existence");
    expect(prompt).toContain("wait for the reported result after asynchronous actions");
    expect(prompt).not.toContain("reference fix");
    expect(prompt).not.toContain("artifacts/");
  });
});
