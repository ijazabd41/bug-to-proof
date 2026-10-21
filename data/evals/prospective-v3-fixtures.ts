/** Ground-truth variants for the next prospective MiniShop cohort. Never send these to generation. */
import type { ProspectiveFixture } from "./prospective-v2-fixtures";

const referenceTest = "tests/playwright/cases/prospective-v3-reference.spec.ts";
const report = (title: string, description: string, steps: string[], expected: string, actual: string) =>
  ({ title, description, steps, expected, actual, startPath: "/", context: "Fresh browser storage and an empty cart." });

export const prospectiveV3Fixtures: ProspectiveFixture[] = [
  {
    id: "p3-dev-free-shipping-at-fifty", split: "dev", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Shipping is charged at exactly fifty dollars", "A $50 cart should qualify for free shipping.",
      ["Open the shop", "Add Mouse Pad twice", "Add Keyboard", "Read Shipping"], "Shipping should be $0.00.", "Shipping shows $5.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "get().total() >= 50", buggyContent: "get().total() > 50" }],
  },
  {
    id: "p3-dev-webcam-price-label", split: "dev", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Webcam catalog price is doubled", "The Webcam product card displays an inflated price.",
      ["Open the shop", "Find the Webcam card", "Read its displayed price"], "Webcam should show $35.00.", "Webcam shows $70.00."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "${product.price.toFixed(2)}", buggyContent: "${(product.id === 4 ? product.price * 2 : product.price).toFixed(2)}" }],
  },
  {
    id: "p3-nav-count-ignores-quantity", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Header cart count ignores repeated quantity", "Two Keyboards count as one in the header.",
      ["Open the shop", "Add Keyboard twice", "Read the Cart link count"], "Cart link should show Cart (2).", "Cart link shows Cart (1)."),
    defects: [{ relativePath: "src/App.tsx", fixedContent: "items.reduce((n, i) => n + i.quantity, 0)", buggyContent: "items.length" }],
  },
  {
    id: "p3-remove-keyboard-does-nothing", category: "deletion", label: "answerable-bug", referenceTest,
    report: report("Remove does not remove Keyboard", "The Keyboard cart line remains after its Remove button is clicked.",
      ["Open the shop", "Add Keyboard", "Click Remove on the Keyboard line"], "Keyboard should disappear from the cart.", "Keyboard remains."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "state.items.filter((i) => i.id !== productId)", buggyContent: "state.items.filter((i) => i.id !== productId || i.id === 1)" }],
  },
  {
    id: "p3-cart-page-checkout-noop", category: "state", label: "answerable-bug", referenceTest,
    report: report("Checkout on full cart page does not clear items", "Checkout works from the sidebar but leaves items on the full cart page.",
      ["Open the shop", "Add Keyboard", "Open Cart using the header link", "Click Checkout on the cart page"], "Cart page should become empty.", "Keyboard remains on the cart page."),
    defects: [{ relativePath: "src/pages/CartPage.tsx", fixedContent: "onClick={clearCart}", buggyContent: "onClick={() => {}}" }],
  },
  {
    id: "p3-cart-page-total-adds-five", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Full cart page total adds five dollars", "The full cart page shows a higher total than the sidebar for one Keyboard.",
      ["Open the shop", "Add Keyboard", "Open Cart using the header link", "Read Total"], "Cart page Total should be $10.00.", "Cart page Total shows $15.00."),
    defects: [{ relativePath: "src/pages/CartPage.tsx", fixedContent: "const cartTotal = total();", buggyContent: "const cartTotal = total() + 5;" }],
  },
  {
    id: "p3-webcam-missing-from-catalog", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Webcam is missing from the catalog", "The shop no longer lists Webcam among the products.",
      ["Open the shop", "Look for the Webcam product card"], "Webcam should be listed.", "Webcam is absent."),
    defects: [{ relativePath: "src/components/ProductList.tsx", fixedContent: "PRODUCTS.map((product) => (", buggyContent: "PRODUCTS.filter((product) => product.id !== 4).map((product) => (" }],
  },
  {
    id: "p3-lowercase-promo-rejected", category: "async", label: "answerable-bug", referenceTest,
    report: report("Lowercase save20 is rejected", "Promo code matching should ignore letter case.",
      ["Open the shop", "Add Keyboard", "Enter save20 in Promo code", "Click Apply", "Wait for validation"], "The app should say Promo code applied!", "The app says Invalid promo code."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "const normalized = code.trim().toUpperCase();", buggyContent: "const normalized = code.trim();" }],
  },
  {
    id: "p3-valid-promo-shows-error", category: "async", label: "answerable-bug", referenceTest,
    report: report("Successful SAVE20 shows an error message", "The discount applies, but the validation message says the code is invalid.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20 in Promo code", "Click Apply", "Wait for validation"], "The app should say Promo code applied!", "The app says Invalid promo code."),
    defects: [{ relativePath: "src/components/Cart.tsx", fixedContent: "if (ok) {\n      setPromoMessage(\"Promo code applied!\");\n    } else {", buggyContent: "if (ok) {\n      setPromoMessage(\"Invalid promo code\");\n    } else {" }],
  },
  {
    id: "p3-webcam-adds-keyboard", category: "state", label: "answerable-bug", referenceTest,
    report: report("Adding Webcam puts Keyboard in the cart", "The Webcam Add to Cart button selects the wrong product.",
      ["Open the shop", "Click Add to Cart on Webcam", "Inspect cart lines"], "Webcam should appear in the cart.", "Keyboard appears instead."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "onClick={() => addItem(product)}", buggyContent: "onClick={() => addItem(product.id === 4 ? { ...product, id: 1, name: \"Keyboard\", price: 10 } : product)}" }],
  },
  {
    id: "p3-shipping-free-too-early", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Small cart gets free shipping", "One Mouse Pad is below the free-shipping threshold.",
      ["Open the shop", "Add Mouse Pad", "Read Shipping"], "Shipping should be $5.00.", "Shipping shows $0.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "get().total() >= 50", buggyContent: "get().total() >= 20" }],
  },
  {
    id: "p3-promo-discounts-first-item-only", category: "multi-file", label: "answerable-bug", referenceTest,
    report: report("SAVE20 discounts only the first cart item", "A two-product cart leaves Mouse Pad at full price after applying SAVE20.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Enter SAVE20", "Click Apply", "Wait for validation", "Read Total"], "Total should be $24.00.", "Total shows $28.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.8).toFixed(2)) })),", buggyContent: "items: state.items.map((i, index) => index === 0 ? { ...i, price: Number((i.price * 0.8).toFixed(2)) } : i)," }],
  },
  {
    id: "p3-cart-webcam-name-wrong", category: "multi-file", label: "answerable-bug", referenceTest,
    report: report("Webcam is labeled Keyboard in shop and cart", "Both the Webcam product card and cart line show the wrong name.",
      ["Open the shop", "Read the Webcam product card name", "Add Webcam", "Read its cart line name"], "Both names should say Webcam.", "Both names say Keyboard."),
    defects: [
      { relativePath: "src/components/ProductCard.tsx", fixedContent: "<span style={{ fontWeight: 600 }}>{product.name}</span>", buggyContent: "<span style={{ fontWeight: 600 }}>{product.id === 4 ? \"Keyboard\" : product.name}</span>" },
      { relativePath: "src/components/CartItem.tsx", fixedContent: "<span>{item.name}</span>", buggyContent: "<span>{item.id === 4 ? \"Keyboard\" : item.name}</span>" },
    ],
  },
  {
    id: "p3-back-link-clears-cart", category: "navigation", label: "answerable-bug", referenceTest,
    report: report("Back to Shop clears the cart", "Returning from the full cart page unexpectedly removes its items.",
      ["Open the shop", "Add Keyboard", "Open Cart", "Click Back to Shop", "Inspect the sidebar cart"], "Keyboard should remain in the cart.", "The cart is empty."),
    defects: [{ relativePath: "src/pages/CartPage.tsx", fixedContent: "to=\"/\"\n          data-testid=\"back-to-shop\"", buggyContent: "to=\"/\"\n          onClick={clearCart}\n          data-testid=\"back-to-shop\"" }],
  },
  {
    id: "p3-control-remove-mouse", category: "control", label: "control", referenceTest,
    report: report("Check removing Mouse Pad", "Confirm a separate Keyboard remains after removing Mouse Pad.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Remove Mouse Pad"], "Keyboard should remain in the cart.", "Keyboard appears to remain."), defects: [],
  },
  {
    id: "p3-control-free-shipping", category: "control", label: "control", referenceTest,
    report: report("Check free shipping at fifty dollars", "Confirm that a $50 cart gets free shipping.",
      ["Open the shop", "Add Mouse Pad twice", "Add Keyboard", "Read Shipping"], "Shipping should be $0.00.", "Shipping appears to be $0.00."), defects: [],
  },
];
