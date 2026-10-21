import { describe, expect, it } from "vitest";
import { validateCandidateAgainstDiscovery } from "./candidatePolicy";

const discovery = {
  schemaVersion: "1.0" as const, sourceFingerprint: "source", inventoryDigest: "inventory",
  routes: ["/", "/cart"],
  controls: [
    { role: "button" as const, name: "Add Widget to cart", sourcePath: "src/App.tsx" },
    { role: "button" as const, name: "Add to Cart", sourcePath: "src/ProductCard.tsx", context: { kind: "product" as const, productId: 1, productName: "Widget" } },
    { role: "button" as const, name: "Add to Cart", sourcePath: "src/ProductCard.tsx", context: { kind: "product" as const, productId: 2, productName: "Gadget" } },
    { role: "link" as const, name: "Cart", sourcePath: "src/App.tsx" },
  ],
  headings: [{ level: 1, text: "Shopping Cart", sourcePath: "src/Cart.tsx" }],
  fixtures: { products: [{ id: 1, name: "Widget", price: 10 }, { id: 2, name: "Gadget", price: 20 }] }, sourceFiles: ["src/App.tsx"], capturedAt: "2026-10-12T00:00:00.000Z",
  targets: [
    { testId: "remove-from-cart-1", sourcePath: "src/CartItem.tsx", context: { kind: "product" as const, productId: 1, productName: "Widget" } },
    { testId: "cart-item-quantity-1", sourcePath: "src/CartItem.tsx", context: { kind: "product" as const, productId: 1, productName: "Widget" } },
    { testId: "cart-total", sourcePath: "src/Cart.tsx" },
    { testId: "cart-subtotal", sourcePath: "src/Cart.tsx" },
    { testId: "shipping-fee", sourcePath: "src/Cart.tsx" },
    { testId: "promo-input", sourcePath: "src/Cart.tsx" },
    { testId: "apply-promo-button", sourcePath: "src/Cart.tsx" },
    { testId: "cart-item-1", sourcePath: "src/CartItem.tsx", context: { kind: "product" as const, productId: 1, productName: "Widget" } },
  ],
};

const definition = {
  schemaVersion: "1.0", title: "Cart total", startPath: "/", preconditions: [],
  steps: [{ type: "click", role: "button", name: "Add Widget to cart" }, { type: "click", role: "link", name: "Cart" }],
  assertion: { type: "urlPathEquals", expected: "/cart" }, rationale: "Matches report",
  reportMapping: [{ reportFact: "Cart route", definitionPath: "assertion.expected" }],
};

describe("candidate discovery policy", () => {
  it("accepts only routes and controls present in the frozen discovery", () => {
    expect(validateCandidateAgainstDiscovery(definition, discovery)).toEqual({ ok: true, findings: [] });
    expect(validateCandidateAgainstDiscovery({ ...definition, startPath: "/admin" }, discovery)).toMatchObject({ ok: false });
    expect(validateCandidateAgainstDiscovery({ ...definition, steps: [{ type: "click", role: "button", name: "Delete everything" }] }, discovery)).toMatchObject({ ok: false });
  });

  it("binds trusted cart setup to discovered product fixtures", () => {
    expect(validateCandidateAgainstDiscovery({ ...definition, preconditions: [{ type: "seedCart", productId: 99, quantity: 1 }] }, discovery)).toMatchObject({ ok: false });
    expect(validateCandidateAgainstDiscovery({ ...definition, startPath: "/cart", preconditions: [{ type: "seedCart", productId: 1, quantity: 1 }] }, discovery)).toMatchObject({ ok: false });
  });

  it("accepts a discovered product-scoped repeated control and rejects ambiguous or unsupported targets", () => {
    const scoped = { ...definition, steps: [{ type: "click", role: "button", name: "Add to Cart", within: { kind: "product", productId: 2 } }] };
    expect(validateCandidateAgainstDiscovery(scoped, discovery)).toEqual({ ok: true, findings: [] });
    expect(validateCandidateAgainstDiscovery({ ...definition, steps: [{ type: "click", role: "button", name: "Add to Cart" }] }, discovery)).toMatchObject({ ok: false });
    expect(validateCandidateAgainstDiscovery({ ...definition, steps: [{ type: "click", role: "button", name: "Add to Cart", within: { kind: "product", productId: 99 } }] }, discovery)).toMatchObject({ ok: false });
  });

  it("accepts only exact test ids from the frozen discovery target inventory", () => {
    const targetDefinition = { ...definition, steps: [{ type: "clickTarget", testId: "remove-from-cart-1" }], assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-1", expected: 1 } };
    expect(validateCandidateAgainstDiscovery(targetDefinition, discovery)).toEqual({ ok: true, findings: [] });
    expect(validateCandidateAgainstDiscovery({ ...targetDefinition, assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-99", expected: 1 } }, discovery)).toMatchObject({ ok: false });
  });

  it("binds fillTarget to an exact discovered test id", () => {
    expect(validateCandidateAgainstDiscovery({ ...definition, steps: [{ type: "fillTarget", testId: "promo-input", text: "SAVE20" }] }, discovery)).toEqual({ ok: true, findings: [] });
    expect(validateCandidateAgainstDiscovery({ ...definition, steps: [{ type: "fillTarget", testId: "unknown-input", text: "SAVE20" }] }, discovery)).toMatchObject({ ok: false });
  });

  it("validates every target in a relational currency assertion against discovery", () => {
    const relational = { ...definition, assertion: { type: "targetCurrencySumEquals", testId: "cart-total", terms: ["cart-subtotal", "shipping-fee"], currency: "USD" } };
    expect(validateCandidateAgainstDiscovery(relational, discovery)).toEqual({ ok: true, findings: [] });
    expect(validateCandidateAgainstDiscovery({ ...relational, assertion: { ...relational.assertion, terms: ["cart-subtotal", "invented-shipping"] } }, discovery)).toMatchObject({ ok: false });
  });

  it("rejects hard navigation after a cart-changing action because it discards MiniShop in-memory state", () => {
    const candidate = { ...definition, steps: [{ type: "clickTarget", testId: "add-to-cart-1" }, { type: "goto", path: "/cart" }] };
    const result = validateCandidateAgainstDiscovery(candidate, { ...discovery, targets: [...discovery.targets, { testId: "add-to-cart-1", sourcePath: "src/ProductCard.tsx" }] });
    expect(result.ok).toBe(false);
    expect(result.findings.join(" ")).toMatch(/navigation|state|reload/i);
  });

  it("rejects visible text assertions aimed at textboxes instead of status messages", () => {
    const candidate = { ...definition, assertion: { type: "visibleTextEquals", role: "textbox", name: "Promo code", expected: "Invalid promo code." } };
    const result = validateCandidateAgainstDiscovery(candidate, { ...discovery, controls: [...discovery.controls, { role: "textbox", name: "Promo code", sourcePath: "src/Cart.tsx" }] });
    expect(result.ok).toBe(false);
    expect(result.findings.join(" ")).toMatch(/textbox|text content|status/i);
  });

  it("rejects exact status or name text assertions on composite and control targets", () => {
    for (const testId of ["promo-input", "apply-promo-button", "cart-item-1"]) {
      const candidate = { ...definition, assertion: { type: "targetTextEquals", testId, expected: testId === "cart-item-1" ? "Widget" : "Invalid promo code." } };
      const result = validateCandidateAgainstDiscovery(candidate, discovery);
      expect(result.ok).toBe(false);
      expect(result.findings.join(" ")).toMatch(/text|status|composite/i);
    }
  });
});
