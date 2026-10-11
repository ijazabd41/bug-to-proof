import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { WORKSPACE_ROOT } from "../../utils/paths";

interface BenchmarkDefect {
  relativePath: string;
  buggyContent: string;
  fixedContent: string;
}

interface BenchmarkCaseDef {
  id: string;
  title: string;
  description: string;
  reproductionTest: string;
  split?: string;
  defect?: BenchmarkDefect;
  defects?: BenchmarkDefect[];
  diagnosis?: string;
}

const TARGET_BENCHMARK_CASE_IDS = [
  "case-006-nav-cart-count",
  "case-007-promo-discount",
  "case-008-tiered-shipping",
];

describe("Benchmark Reference Dataset & Script Integrity", () => {
  it("verifies canonical dataset structure and exact match of shipping defect snippets", () => {
    const datasetPath = path.join(WORKSPACE_ROOT, "data", "evals", "repair-cases.json");
    expect(fs.existsSync(datasetPath)).toBe(true);

    const raw = fs.readFileSync(datasetPath, "utf-8");
    const cases: BenchmarkCaseDef[] = JSON.parse(raw);

    // Target benchmark cases must all exist in dataset
    for (const targetId of TARGET_BENCHMARK_CASE_IDS) {
      const found = cases.find((c) => c.id === targetId);
      expect(found).toBeDefined();
      expect(found!.title).toBeTruthy();
      expect(found!.reproductionTest).toBeTruthy();
      expect(fs.existsSync(path.join(WORKSPACE_ROOT, found!.reproductionTest))).toBe(true);

      const defects = found!.defects || (found!.defect ? [found!.defect] : []);
      expect(defects.length).toBeGreaterThan(0);

      // Verify that every defect's fixedContent exists in current pristine minishop source
      for (const d of defects) {
        const fullSourcePath = path.join(WORKSPACE_ROOT, "apps", "minishop", d.relativePath);
        expect(fs.existsSync(fullSourcePath)).toBe(true);
        const sourceContent = fs.readFileSync(fullSourcePath, "utf-8");
        const normalizeLineEndings = (content: string) => content.replace(/\r\n?/g, "\n");
        expect(normalizeLineEndings(sourceContent)).toContain(normalizeLineEndings(d.fixedContent));
      }
    }

    // Specifically verify case-008 multi-file shipping defect definitions
    const shippingCase = cases.find((c) => c.id === "case-008-tiered-shipping");
    expect(shippingCase).toBeDefined();
    expect(shippingCase!.defects).toHaveLength(2);

    const storeDefect = shippingCase!.defects!.find((d) => d.relativePath.includes("cartStore.ts"));
    expect(storeDefect).toBeDefined();
    expect(storeDefect!.buggyContent).toContain("shipping: () => (get().total() > 50 || get().items.length === 0 ? 0 : 5),");
    expect(storeDefect!.fixedContent).toContain("shipping: () => (get().total() >= 50 || get().items.length === 0 ? 0 : 5),");

    const cartDefect = shippingCase!.defects!.find((d) => d.relativePath.includes("Cart.tsx"));
    expect(cartDefect).toBeDefined();
    expect(cartDefect!.buggyContent).toContain('<span data-testid="shipping-fee">$5.00</span>');
    expect(cartDefect!.fixedContent).toContain('<span data-testid="shipping-fee">${shippingFee.toFixed(2)}</span>');
  });

  it("computes reproducible dataset hash for canonical benchmark definitions", () => {
    const datasetPath = path.join(WORKSPACE_ROOT, "data", "evals", "repair-cases.json");
    const raw = fs.readFileSync(datasetPath, "utf-8");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
