import React from "react";
import { ProductList } from "../components/ProductList";
import { Cart } from "../components/Cart";

export function ShopPage() {
  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <ProductList />
      </div>
      <div>
        <Cart />
      </div>
    </div>
  );
}
