/** Independent MiniShop defect variants. Never include these snippets or reference tests in generation input. */
import type { ProspectiveFixture } from "./prospective-v2-fixtures";

const referenceTest = "tests/playwright/cases/prospective-v4-reference.spec.ts";
const report = (title: string, description: string, steps: string[], expected: string, actual: string) =>
  ({ title, description, steps, expected, actual, startPath: "/", context: "Fresh browser storage and an empty cart." });

export const prospectiveV4Fixtures: ProspectiveFixture[] = [
  {
    id: "p4-dev-promo-success-message-absent", split: "dev", category: "async", label: "answerable-bug", referenceTest,
    report: report("Successful promo has no confirmation", "SAVE20 discounts the cart, but its confirmation message does not appear.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20", "Click Apply", "Wait for the confirmation"],
      "Promo status should say Promo code applied!", "No promo status appears."),
    defects: [{ relativePath: "src/components/Cart.tsx", fixedContent: 'setPromoMessage("Promo code applied!");', buggyContent: 'setPromoMessage("");' }],
  },
  {
    id: "p4-dev-mouse-catalog-price-wrong", split: "dev", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Mouse Pad catalog price is too high", "The Mouse Pad product card shows a price different from its catalog data.",
      ["Open the shop", "Find the Mouse Pad card", "Read its price"], "$20.00 should appear on Mouse Pad.", "$25.00 appears."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: '${product.price.toFixed(2)}', buggyContent: '${(product.id === 2 ? 25 : product.price).toFixed(2)}' }],
  },
  {
    id: "p4-third-keyboard-add-capped", category: "state", label: "answerable-bug", referenceTest,
    report: report("Third Keyboard add does not increase quantity", "The Keyboard cart line stops increasing at two.",
      ["Open the shop", "Add Keyboard three times", "Read Keyboard quantity"], "Quantity should show ×3.", "Quantity shows ×2."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "i.quantity + 1", buggyContent: "Math.min(i.quantity + 1, 2)" }],
  },
  {
    id: "p4-remove-mouse-clears-keyboard", category: "deletion", label: "answerable-bug", referenceTest,
    report: report("Removing Mouse Pad also removes Keyboard", "A separate Keyboard disappears when Mouse Pad is removed.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Remove Mouse Pad", "Inspect Keyboard"],
      "Keyboard should remain in the cart.", "Keyboard disappears."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "state.items.filter((i) => i.id !== productId)", buggyContent: "productId === 2 ? [] : state.items.filter((i) => i.id !== productId)" }],
  },
  {
    id: "p4-sidebar-checkout-keeps-mouse", category: "state", label: "answerable-bug", referenceTest,
    report: report("Sidebar Checkout leaves Mouse Pad", "The sidebar Checkout removes Keyboard but leaves Mouse Pad.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Click Checkout in the sidebar"],
      "The cart should become empty.", "Mouse Pad remains."),
    defects: [{ relativePath: "src/components/Cart.tsx", fixedContent: "onClick={clearCart}", buggyContent: "onClick={() => { useCartStore.setState((state) => ({ items: state.items.filter((item) => item.id === 2) })); }}" }],
  },
  {
    id: "p4-usb-total-under-counts", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("USB Hub total is one dollar low", "Adding one USB Hub produces the wrong cart total.",
      ["Open the shop", "Add USB Hub", "Read Total"], "Total should be $15.00.", "Total shows $14.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "sum + item.price * item.quantity, 0)", buggyContent: "sum + (item.id === 3 ? item.price - 1 : item.price) * item.quantity, 0)" }],
  },
  {
    id: "p4-webcam-catalog-name-camera", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Webcam catalog card says Camera", "The Webcam item has the wrong name in the product catalog.",
      ["Open the shop", "Find the Webcam product card", "Read its name"], "The card name should say Webcam.", "The card says Camera."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "{product.name}</span>", buggyContent: '{product.id === 4 ? "Camera" : product.name}</span>' }],
  },
  {
    id: "p4-keyboard-cart-name-mouse", category: "rendering", label: "answerable-bug", referenceTest,
    report: report("Keyboard cart line says Mouse Pad", "The Keyboard name changes when it appears in the cart.",
      ["Open the shop", "Add Keyboard", "Read its cart line name"], "The cart line should say Keyboard.", "The cart line says Mouse Pad."),
    defects: [{ relativePath: "src/components/CartItem.tsx", fixedContent: "{item.name}</span>", buggyContent: '{item.id === 1 ? "Mouse Pad" : item.name}</span>' }],
  },
  {
    id: "p4-forty-five-cart-free-shipping", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Forty-five dollar cart gets free shipping", "A cart below the fifty-dollar threshold is marked free shipping.",
      ["Open the shop", "Add Keyboard", "Add Mouse Pad", "Add USB Hub", "Read Shipping"],
      "Shipping should be $5.00.", "Shipping shows $0.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "get().total() >= 50", buggyContent: "get().total() >= 45" }],
  },
  {
    id: "p4-promo-success-without-discount", category: "async", label: "answerable-bug", referenceTest,
    report: report("SAVE20 confirms but leaves total unchanged", "The success message appears without reducing the cart total.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20", "Click Apply", "Wait for confirmation", "Read Total"],
      "Total should be $8.00.", "Total remains $10.00."),
    defects: [{ relativePath: "src/store/cartStore.ts", fixedContent: "items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.8).toFixed(2)) })),", buggyContent: "items: state.items," }],
  },
  {
    id: "p4-invalid-promo-shows-success", category: "async", label: "answerable-bug", referenceTest,
    report: report("Invalid promo displays a success message", "A rejected promo code is shown as applied.",
      ["Open the shop", "Add Keyboard", "Enter NOPE", "Click Apply", "Wait for validation"],
      "Promo status should say Invalid promo code.", "Promo status says Promo code applied!."),
    defects: [{ relativePath: "src/components/Cart.tsx", fixedContent: '} else {\n      setPromoMessage("Invalid promo code");\n    }', buggyContent: '} else {\n      setPromoMessage("Promo code applied!");\n    }' }],
  },
  {
    id: "p4-mouse-adds-two-at-once", category: "state", label: "answerable-bug", referenceTest,
    report: report("One Mouse Pad click adds two", "A single Add to Cart action doubles Mouse Pad quantity.",
      ["Open the shop", "Click Add to Cart on Mouse Pad once", "Read Mouse Pad quantity"],
      "Quantity should show ×1.", "Quantity shows ×2."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "onClick={() => addItem(product)}", buggyContent: "onClick={() => { addItem(product); if (product.id === 2) addItem(product); }}" }],
  },
  {
    id: "p4-single-keyboard-nav-count-zero", category: "navigation", label: "answerable-bug", referenceTest,
    report: report("Header count stays empty after adding Keyboard", "One Keyboard is present in the cart but the Cart link shows no count.",
      ["Open the shop", "Add Keyboard", "Read the Cart link"],
      "Cart link should show Cart (1).", "Cart link shows Cart."),
    defects: [{ relativePath: "src/App.tsx", fixedContent: "items.reduce((n, i) => n + i.quantity, 0)", buggyContent: "items.length === 1 ? 0 : items.reduce((n, i) => n + i.quantity, 0)" }],
  },
  {
    id: "p4-cart-page-ignores-quantity", category: "calculation", label: "answerable-bug", referenceTest,
    report: report("Full cart page total ignores quantity", "The full cart page shows the price of one Keyboard after two were added.",
      ["Open the shop", "Add Keyboard twice", "Open Cart with the header link", "Read Total"],
      "Cart page Total should be $20.00.", "Cart page Total shows $10.00."),
    defects: [{ relativePath: "src/pages/CartPage.tsx", fixedContent: "const cartTotal = total();", buggyContent: "const cartTotal = items.reduce((sum, item) => sum + item.price, 0);" }],
  },
  {
    id: "p4-control-valid-promo", category: "control", label: "control", referenceTest,
    report: report("Check SAVE20 confirmation", "Confirm the status after applying the valid code to a Keyboard cart.",
      ["Open the shop", "Add Keyboard", "Enter SAVE20", "Click Apply", "Wait for status"],
      "Promo status should say Promo code applied!", "Promo status appears to say Promo code applied!"), defects: [],
  },
  {
    id: "p4-control-webcam-price", category: "control", label: "control", referenceTest,
    report: report("Check Webcam catalog price", "Confirm the product card price for Webcam.",
      ["Open the shop", "Find Webcam", "Read its catalog price"],
      "Webcam price should be $35.00.", "Webcam price appears to be $35.00."), defects: [],
  },
];
