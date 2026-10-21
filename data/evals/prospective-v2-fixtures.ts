/** Development fixture definitions. Do not pass defect snippets or reference tests to generation. */
export interface ProspectiveFixture {
  id: string;
  split?: "dev" | "held-out";
  category: string;
  label: "answerable-bug" | "control";
  report: { title: string; description: string; steps: string[]; expected: string; actual: string; startPath: string; context: string };
  defects: Array<{ relativePath: string; fixedContent: string; buggyContent: string }>;
  referenceTest: string;
}

const referenceTest = "tests/playwright/cases/prospective-v2-reference.spec.ts";
const report = (title: string, description: string, steps: string[], expected: string, actual: string) =>
  ({ title, description, steps, expected, actual, startPath: "/", context: "Fresh browser storage and an empty cart." });

export const prospectiveV2Fixtures: ProspectiveFixture[] = [
  {
    id: "p2-dev-total-first-item", split: "dev", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Total reads only first cart item", "A second distinct product does not increase the cart total.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Read Total"], "Total should be $30.00.", "Total stays $10.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)", buggyContent: "get().items[0]?.price ?? 0" }],
  },
  {
    id: "p2-dev-quantity-stuck", split: "dev", category: "state", label: "answerable-bug", referenceTest,
    report: report("Repeated add leaves quantity at one", "A second Keyboard click does not increase the cart line quantity.",
      ["Open the shop", "Add Keyboard twice", "Read its quantity"], "Quantity should display ×2.", "Quantity stays ×1."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i", buggyContent: "i.id === product.id ? { ...i, quantity: 1 } : i" }],
  },
  {
    id: "p2-total-extra-fee", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Single-item total contains an extra charge", "The cart total is two dollars too high with one Keyboard.",
      ["Open the shop", "Add one Keyboard", "Read Total"], "Total should be $10.00.", "Total shows $12.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "sum + item.price * item.quantity, 0)", buggyContent: "sum + item.price * item.quantity + 2, 0)" }],
  },
  {
    id: "p2-second-product-ignored", category: "state", label: "answerable-bug", referenceTest,
    report: report("Second distinct product is not added", "Mouse Pad is missing after it is added to a cart containing Keyboard.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Inspect cart lines"], "Keyboard and Mouse Pad should both appear.", "Only Keyboard appears."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "return { items: [...state.items, { ...product, quantity: 1 }] };", buggyContent: "return { items: state.items.length ? state.items : [...state.items, { ...product, quantity: 1 }] };" }],
  },
  {
    id: "p2-remove-mouse-removes-keyboard", category: "deletion", label: "answerable-bug", referenceTest,
    report: report("Removing Mouse Pad also removes Keyboard", "A separate cart line disappears when Mouse Pad is removed.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Remove Mouse Pad"], "Keyboard should remain in the cart.", "The cart becomes empty."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "state.items.filter((i) => i.id !== productId)", buggyContent: "state.items.filter((i) => i.id !== productId && i.id !== 1)" }],
  },
  {
    id: "p2-checkout-keeps-cart", category: "multi-file", label: "answerable-bug", referenceTest,
    report: report("Checkout does not clear cart on either screen", "Checkout leaves items in the sidebar and full cart page.",
      ["Open the shop", "Add Keyboard", "Click Checkout in the sidebar", "Open Cart", "Click Checkout on the cart page"], "The cart should be empty after Checkout.", "Keyboard remains after Checkout."),
    defects: [
      { relativePath: "src/components/Cart.tsx", fixedContent: "onClick={clearCart}", buggyContent: "onClick={() => {}}" },
      { relativePath: "src/pages/CartPage.tsx", fixedContent: "onClick={clearCart}", buggyContent: "onClick={() => {}}" },
    ],
  },
  {
    id: "p2-cart-link-opens-shop", category: "navigation", label: "answerable-bug", referenceTest,
    report: report("Cart navigation opens the shop", "The navigation Cart link leaves the browser on the shop route.",
      ["Open the shop", "Click Cart in the header"], "The URL path should be /cart.", "The URL path stays /.",),
    defects: [{ relativePath: "src/App.tsx", fixedContent: "to=\"/cart\"\n        data-testid=\"nav-cart-link\"", buggyContent: "to=\"/\"\n        data-testid=\"nav-cart-link\"" }],
  },
  {
    id: "p2-back-link-stays-cart", category: "navigation", label: "answerable-bug", referenceTest,
    report: report("Back to Shop stays on Cart", "The Back to Shop link on the cart page does not return to the shop.",
      ["Open the shop", "Click Cart", "Click Back to Shop"], "The URL path should be /.", "The URL path remains /cart."),
    defects: [{ relativePath: "src/pages/CartPage.tsx", fixedContent: "to=\"/\"\n          data-testid=\"back-to-shop\"", buggyContent: "to=\"/cart\"\n          data-testid=\"back-to-shop\"" }],
  },
  {
    id: "p2-quantity-label-off-by-one", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Cart line quantity is one too high", "One Keyboard is displayed with quantity two.",
      ["Open the shop", "Add one Keyboard", "Read the Keyboard cart line quantity"], "Quantity should display ×1.", "Quantity displays ×2."),
    defects: [{ relativePath: "src/components/CartItem.tsx", fixedContent: "×{item.quantity}", buggyContent: "×{item.quantity + 1}" }],
  },
  {
    id: "p2-line-price-ignores-quantity", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Cart line price ignores quantity", "Two Keyboards show a single-item line price.",
      ["Open the shop", "Add Keyboard twice", "Read the Keyboard cart line price"], "Line price should be $20.00.", "Line price shows $10.00."),
    defects: [{ relativePath: "src/components/CartItem.tsx", fixedContent: "item.price * item.quantity", buggyContent: "item.price" }],
  },
  {
    id: "p2-invalid-promo-accepted", category: "async", label: "answerable-bug", referenceTest,
    report: report("Invalid promo code is reported as applied", "The app confirms an unknown promo code.",
      ["Open the shop", "Add Keyboard", "Enter NOTREAL in Promo code", "Click Apply", "Wait for validation"], "The app should say Invalid promo code.", "The app says Promo code applied!."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "    return false;\n  },\n\n  clearPromoCode:", buggyContent: "    return true;\n  },\n\n  clearPromoCode:" }],
  },
  {
    id: "p2-promo-clears-items", category: "async", label: "answerable-bug", referenceTest,
    report: report("Promo validation empties the cart", "A valid promo removes the item already in the cart.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20", "Click Apply", "Wait for validation"], "Keyboard should remain in the cart.", "The cart becomes empty."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "discountPercent: 20,\n        items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.8).toFixed(2)) })),", buggyContent: "discountPercent: 20,\n        items: []," }],
  },
  {
    id: "p2-shipping-fee-six", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Shipping fee is one dollar too high", "A small cart shows six dollars shipping.",
      ["Open the shop", "Add Keyboard", "Read Shipping"], "Shipping should be $5.00.", "Shipping shows $6.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "get().items.length === 0 ? 0 : 5", buggyContent: "get().items.length === 0 ? 0 : 6" }],
  },
  {
    id: "p2-promo-discount-ten", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("SAVE20 gives ten percent instead of twenty", "A ten-dollar Keyboard is nine dollars after SAVE20.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20", "Click Apply", "Wait for validation", "Read Total"], "Total should be $8.00.", "Total shows $9.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "discountPercent: 20,\n        items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.8).toFixed(2)) })),", buggyContent: "discountPercent: 10,\n        items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.9).toFixed(2)) }))," }],
  },
  {
    id: "p2-control-correct-total", category: "control", label: "control", referenceTest,
    report: report("Check a normal single-item total", "Verify that a cart with one Keyboard has the expected total.",
      ["Open the shop", "Add Keyboard", "Read Total"], "Total should be $10.00.", "Total appears to be $10.00."), defects: [],
  },
  {
    id: "p2-control-correct-navigation", category: "control", label: "control", referenceTest,
    report: report("Check normal Cart navigation", "Verify that the header Cart link opens the cart page.",
      ["Open the shop", "Click Cart in the header"], "The URL path should be /cart.", "The URL path appears to be /cart."), defects: [],
  },
];
