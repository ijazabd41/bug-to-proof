import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverTargetSurface, persistTargetDiscovery, validateApplicationPath } from "./targetDiscovery";

const roots: string[] = [];
function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-discovery-"));
  roots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("bounded target discovery", () => {
  it("inventories the configured MiniShop surface", () => {
    const minishopDir = path.resolve(__dirname, "../../../../apps/minishop");
    const result = discoverTargetSurface(minishopDir);
    expect(result.routes).toEqual(["/", "/cart"]);
    expect(result.fixtures.products.map(product => product.name)).toEqual(["Keyboard", "Mouse Pad", "USB Hub", "Webcam"]);
    expect(result.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "link", name: "Cart" }),
      expect.objectContaining({ role: "button", name: "Checkout" }),
      expect.objectContaining({ role: "textbox", name: "Promo code" }),
    ]));
    expect(result.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ testId: "promo-status" }),
      expect.objectContaining({ testId: "cart-item-name-1" }),
      expect.objectContaining({ testId: "product-name-4" }),
      expect.objectContaining({ testId: "product-price-4" }),
    ]));
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inventoryDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("inventories routes, accessible controls, headings, and product fixtures deterministically", () => {
    const root = fixture({
      "src/App.tsx": `<Routes><Route path="/" element={<Shop/>}/><Route path="/cart" element={<Cart/>}/></Routes><Link to="/cart">Cart</Link>`,
      "src/Shop.tsx": `<main><h1>Products</h1><button aria-label="Add Keyboard">Add to cart</button><input aria-label="Promo code" /></main>`,
      "src/data/products.ts": `export const PRODUCTS = [{ id: 1, name: "Keyboard", price: 10 }];`,
    });

    const first = discoverTargetSurface(root);
    const second = discoverTargetSurface(root);
    expect(first.routes).toEqual(["/", "/cart"]);
    expect(first.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "link", name: "Cart", sourcePath: "src/App.tsx" }),
      expect.objectContaining({ role: "button", name: "Add Keyboard", sourcePath: "src/Shop.tsx" }),
      expect.objectContaining({ role: "textbox", name: "Promo code", sourcePath: "src/Shop.tsx" }),
    ]));
    expect(first.headings).toContainEqual(expect.objectContaining({ level: 1, text: "Products" }));
    expect(first.fixtures.products).toEqual([{ id: 1, name: "Keyboard", price: 10 }]);
    expect(first.inventoryDigest).toBe(second.inventoryDigest);
    expect(first.sourceFingerprint).toBe(second.sourceFingerprint);
  });

  it("binds a repeated product template control to each discovered product context", () => {
    const root = fixture({
      "src/ProductCard.tsx": `<div><span>{product.name}</span><button data-testid={\`add-to-cart-\${product.id}\`}>Add to Cart</button></div>`,
      "src/data/products.ts": `export const PRODUCTS = [{ id: 1, name: "Keyboard", price: 10 }, { id: 2, name: "Mouse", price: 20 }];`,
    });
    const result = discoverTargetSurface(root);
    expect(result.controls.filter(control => control.name === "Add to Cart")).toEqual([
      expect.objectContaining({ context: { kind: "product", productId: 1, productName: "Keyboard" } }),
      expect.objectContaining({ context: { kind: "product", productId: 2, productName: "Mouse" } }),
    ]);
  });

  it("inventories literal and product-templated test ids as trusted locator targets", () => {
    const root = fixture({
      "src/Cart.tsx": `<span data-testid="cart-total">{total}</span><span data-testid="shipping-fee">{shipping}</span>`,
      "src/CartItem.tsx": `<div data-testid={\`cart-item-\${productId}\`}><span data-testid={\`cart-item-quantity-\${productId}\`}>{quantity}</span><button aria-label="Remove item" data-testid={\`remove-from-cart-\${productId}\`}>x</button></div>`,
      "src/data/products.ts": `export const PRODUCTS = [{ id: 1, name: "Keyboard", price: 10 }, { id: 2, name: "Mouse", price: 20 }];`,
    });
    const result = discoverTargetSurface(root);
    expect(result.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ testId: "cart-total", sourcePath: "src/Cart.tsx" }),
      expect.objectContaining({ testId: "shipping-fee", sourcePath: "src/Cart.tsx" }),
      expect.objectContaining({ testId: "cart-item-quantity-1", context: { kind: "product", productId: 1, productName: "Keyboard" } }),
      expect.objectContaining({ testId: "remove-from-cart-2", context: { kind: "product", productId: 2, productName: "Mouse" } }),
    ]));
  });

  it("rejects cross-origin and protocol-relative paths", () => {
    expect(() => validateApplicationPath("https://example.com/cart")).toThrow(/application-relative/i);
    expect(() => validateApplicationPath("//example.com/cart")).toThrow(/application-relative/i);
    expect(validateApplicationPath("/cart?tab=items")).toBe("/cart?tab=items");
  });

  it("fails closed when source input exceeds its byte budget", () => {
    const root = fixture({ "src/App.tsx": `<button>${"x".repeat(200)}</button>` });
    expect(() => discoverTargetSurface(root, { maxSourceBytes: 100 })).toThrow(/byte limit/i);
  });

  it("persists the exact hashed discovery snapshot", () => {
    const root = fixture({ "src/App.tsx": `<Route path="/" element={<Shop/>}/>` });
    const artifactDir = path.join(root, "artifacts");
    const snapshot = discoverTargetSurface(root);
    const artifact = persistTargetDiscovery(snapshot, artifactDir);
    expect(JSON.parse(fs.readFileSync(artifact.artifactPath, "utf8"))).toEqual(snapshot);
    expect(artifact.artifactHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sanitizes inventory text and excludes scripts and hidden inputs", () => {
    const root = fixture({
      "src/App.tsx": `<script>alert('secret')</script><input type="hidden" value="token"/><button>Run <b>checkout</b></button>`,
    });
    const result = discoverTargetSurface(root);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("token");
    expect(result.controls).toContainEqual(expect.objectContaining({ role: "button", name: "Run checkout" }));
  });
});
