import React from "react";
import { useCartStore, type Product } from "../store/cartStore";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "16px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span style={{ fontWeight: 600 }}>{product.name}</span>
      <span style={{ color: "#6b7280" }}>${product.price.toFixed(2)}</span>
      <button
        data-testid={`add-to-cart-${product.id}`}
        onClick={() => addItem(product)}
        style={{
          marginTop: 8,
          padding: "8px 16px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Add to Cart
      </button>
    </div>
  );
}
