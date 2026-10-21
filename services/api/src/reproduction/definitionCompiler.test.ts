import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  COMPILER_VERSION,
  canonicalizeReproductionDefinition,
  compileReproductionDefinition,
  persistCompiledReproduction,
  validateReproductionDefinition,
} from "./definitionCompiler";

const temporary: string[] = [];

function supportedDefinition() {
  return {
    schemaVersion: "1.0",
    title: "Cart total includes quantity",
    startPath: "/",
    preconditions: [{ type: "clearLocalStorage" }],
    steps: [
      { type: "click", role: "button", name: "Add Widget to cart" },
      { type: "goto", path: "/cart" },
      { type: "waitForVisible", role: "heading", name: "Cart" },
    ],
    assertion: { type: "currencyEquals", role: "status", name: "Cart total", expected: 30, currency: "USD" },
    rationale: "The total must include item quantity.",
    reportMapping: [{ reportFact: "Expected total is $30", definitionPath: "assertion.expected" }],
  };
}

afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("reproduction definition V1", () => {
  it("validates and canonicalizes a supported definition independent of object key order", () => {
    const first = validateReproductionDefinition(supportedDefinition());
    const original = supportedDefinition();
    const reordered = validateReproductionDefinition({
      reportMapping: original.reportMapping,
      rationale: original.rationale,
      assertion: original.assertion,
      steps: original.steps,
      preconditions: original.preconditions,
      startPath: original.startPath,
      title: original.title,
      schemaVersion: original.schemaVersion,
    });
    expect(first.ok).toBe(true);
    expect(reordered.ok).toBe(true);
    if (!reordered.ok || !first.ok) throw new Error("expected valid definitions");
    expect(canonicalizeReproductionDefinition(reordered.value)).toBe(canonicalizeReproductionDefinition(first.value));
  });

  it.each([
    ["unknown top-level key", { ...supportedDefinition(), code: "process.exit()" }],
    ["raw action code", { ...supportedDefinition(), steps: [{ type: "evaluate", code: "fetch('https://evil.test')" }] }],
    ["external navigation", { ...supportedDefinition(), steps: [{ type: "goto", path: "https://evil.test" }] }],
    ["selector injection", { ...supportedDefinition(), steps: [{ type: "click", selector: "#pay", role: "button", name: "Pay" }] }],
    ["prototype pollution", JSON.parse('{"schemaVersion":"1.0","title":"x","startPath":"/","preconditions":[],"steps":[],"assertion":{"type":"urlPathEquals","expected":"/"},"rationale":"x","reportMapping":[],"__proto__":{"polluted":true}}')],
  ])("rejects %s", (_label, candidate) => {
    const result = validateReproductionDefinition(candidate);
    expect(result.ok).toBe(false);
  });

  it("enforces byte, step, mapping, and bounded-string limits", () => {
    expect(validateReproductionDefinition({ ...supportedDefinition(), title: "x".repeat(501) }).ok).toBe(false);
    expect(validateReproductionDefinition({ ...supportedDefinition(), steps: Array.from({ length: 21 }, () => ({ type: "reload" })) }).ok).toBe(false);
    expect(validateReproductionDefinition({ ...supportedDefinition(), reportMapping: Array.from({ length: 21 }, () => ({ reportFact: "x", definitionPath: "steps.0" })) }).ok).toBe(false);
    expect(validateReproductionDefinition(JSON.stringify({ ...supportedDefinition(), rationale: "x".repeat(33_000) })).ok).toBe(false);
  });

  it("compiles identical input to identical escaped bytes and stable hashes", () => {
    const hostile = supportedDefinition();
    hostile.steps[0] = { type: "fill", label: "Name ` ${danger}", text: "</script>\n'; process.exit() //" } as never;
    const compiledA = compileReproductionDefinition(hostile, "definition-123");
    const compiledB = compileReproductionDefinition(JSON.stringify(hostile), "definition-123");
    expect(compiledA.source).toBe(compiledB.source);
    expect(compiledA.definitionHash).toBe(compiledB.definitionHash);
    expect(compiledA.compiledHash).toBe(compiledB.compiledHash);
    expect(compiledA.compilerVersion).toBe(COMPILER_VERSION);
    expect(compiledA.testIdentity).toBe(`btp-definition-123-v1-${compiledA.definitionHash.slice(0, 12)}`);
    expect(compiledA.source).toContain("BTP_ASSERTION");
    expect(compiledA.source).toContain('testInfo.attach("btp-assertion"');
    expect(compiledA.source).toContain("actual: String(received)");
    expect(compiledA.source).toContain("expected: String(expected)");
    expect(compiledA.source).toContain("getByLabel");
  });

  it("emits every supported action and assertion through trusted Playwright APIs", () => {
    const actions = [
      { type: "goto", path: "/cart" }, { type: "click", role: "button", name: "Checkout" },
      { type: "fill", label: "Promo code", text: "SAVE10" }, { type: "selectOption", label: "Quantity", value: "2" },
      { type: "waitForVisible", role: "heading", name: "Cart" }, { type: "reload" },
    ];
    const assertions = [
      { type: "visibleTextEquals", role: "status", name: "Total", expected: "$30.00" },
      { type: "numberEquals", role: "status", name: "Quantity", expected: 2 },
      { type: "currencyEquals", role: "status", name: "Total", expected: 30, currency: "USD" },
      { type: "countEquals", role: "listitem", expected: 2 }, { type: "urlPathEquals", expected: "/cart" },
      { type: "visibilityEquals", role: "button", name: "Checkout", visible: true },
      { type: "accessibleAttributeEquals", role: "button", name: "Checkout", attribute: "aria-disabled", expected: "false" },
    ];
    for (const assertion of assertions) {
      const result = compileReproductionDefinition({ ...supportedDefinition(), steps: actions, assertion }, "all-supported");
      expect(result.source).toContain("BTP_ASSERTION");
    }
  });

  it("compiles only the fixed product context locator shape for repeated controls", () => {
    const scoped = { ...supportedDefinition(), steps: [{ type: "click", role: "button", name: "Add to Cart", within: { kind: "product", productId: 2 } }] };
    const result = compileReproductionDefinition(scoped, "product-scoped");
    expect(result.source).toContain("locateInProduct");
    expect(result.source).toContain("productId");
    expect(validateReproductionDefinition({ ...supportedDefinition(), steps: [{ type: "click", role: "button", name: "Add to Cart", within: { kind: "css", selector: "#product-2" } }] }).ok).toBe(false);
  });

  it("compiles discovery-bound test-id actions and assertions through getByTestId only", () => {
    const result = compileReproductionDefinition({
      ...supportedDefinition(),
      steps: [{ type: "clickTarget", testId: "remove-from-cart-1" }],
      assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-1", expected: 1 },
    }, "inventory-target");
    expect(result.source).toContain("getByTestId");
    expect(result.source).toContain("clickTarget");
    expect(result.source).toContain("targetNumberEquals");
    expect(result.source).toContain('"<missing>"');
    expect(result.source).not.toContain("locator(");
    expect(validateReproductionDefinition({ ...supportedDefinition(), steps: [{ type: "clickTarget", testId: "x", selector: "#unsafe" }] }).ok).toBe(false);
  });

  it("compiles discovery-bound textbox input through getByTestId instead of an inferred label", () => {
    const result = compileReproductionDefinition({
      ...supportedDefinition(),
      steps: [{ type: "fillTarget", testId: "promo-input", text: "SAVE20" }],
    }, "inventory-fill-target");
    expect(result.source).toContain("fillTarget");
    expect(result.source).toContain("getByTestId(step.testId).fill(step.text)");
    expect(validateReproductionDefinition({ ...supportedDefinition(), steps: [{ type: "fillTarget", testId: "promo-input", text: "SAVE20", selector: "#unsafe" }] }).ok).toBe(false);
  });

  it("compiles a discovery-bound currency sum relationship without model-authored code", () => {
    const result = compileReproductionDefinition({
      ...supportedDefinition(),
      assertion: { type: "targetCurrencySumEquals", testId: "cart-total", terms: ["cart-subtotal", "shipping-fee"], currency: "USD" },
    }, "currency-sum");
    expect(result.source).toContain("targetCurrencySumEquals");
    expect(result.source).toContain("normalizeCurrencyCents");
    expect(result.source).toContain("assertion.terms");
    expect(result.source).not.toContain("assertion.code");
  });

  it("rejects relational prose as a literal target text expectation", () => {
    const result = validateReproductionDefinition({
      ...supportedDefinition(),
      assertion: { type: "targetTextEquals", testId: "cart-total", expected: "Total equals subtotal plus visible shipping" },
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/relational|computed/i);
  });

  it("implements seedCart through trusted product actions instead of application storage internals", () => {
    const result = compileReproductionDefinition({ ...supportedDefinition(), preconditions: [{ type: "seedCart", productId: 1, quantity: 2 }] }, "seed-via-ui");
    expect(result.source).toContain("add-to-cart-${precondition.productId}");
    expect(result.source).toContain("clickCount: precondition.quantity");
    expect(result.source).not.toContain("localStorage.setItem");
  });

  it("writes only inside the run-specific generated directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-compiler-")); temporary.push(root);
    const result = persistCompiledReproduction(supportedDefinition(), "run-123", root);
    expect(result.filePath).toBe(path.join(root, "run-123", "generated-test", "reproduction.spec.ts"));
    expect(fs.readFileSync(result.filePath, "utf8")).toBe(result.source);
    expect(() => persistCompiledReproduction(supportedDefinition(), "../escape", root)).toThrow(/run id/i);
  });
});
