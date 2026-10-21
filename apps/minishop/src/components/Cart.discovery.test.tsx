/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { Cart } from "./Cart";
import { useCartStore } from "../store/cartStore";

describe("MiniShop discovery targets", () => {
  it("exposes the cart product name and asynchronous promo result as distinct text targets", async () => {
    useCartStore.setState({ items: [{ id: 1, name: "Keyboard", price: 10, quantity: 1 }], promoCode: null, discountPercent: 0 });
    render(<Cart />);
    expect(screen.getByTestId("cart-item-name-1")).toHaveTextContent("Keyboard");
    fireEvent.change(screen.getByTestId("promo-input"), { target: { value: "SAVE20" } });
    fireEvent.click(screen.getByTestId("apply-promo-button"));
    expect(await screen.findByTestId("promo-status")).toHaveTextContent("Promo code applied!");
  });
});
