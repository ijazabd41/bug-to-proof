/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { ProductCard } from "./ProductCard";

describe("product discovery targets", () => {
  it("exposes a product's name and price separately", () => {
    render(<ProductCard product={{ id: 4, name: "Webcam", price: 35 }} />);
    expect(screen.getByTestId("product-name-4")).toHaveTextContent("Webcam");
    expect(screen.getByTestId("product-price-4")).toHaveTextContent("$35.00");
  });
});
