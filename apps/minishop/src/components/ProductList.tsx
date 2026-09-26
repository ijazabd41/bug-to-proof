import React from "react";
import { PRODUCTS } from "../data/products";
import { ProductCard } from "./ProductCard";

export function ProductList() {
  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Products</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
