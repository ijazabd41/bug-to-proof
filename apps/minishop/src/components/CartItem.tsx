import React from "react";
import { useCartStore } from "../store/cartStore";

export function CartItem({ productId }: { productId: number }) {
  const item = useCartStore((s) => s.items.find((i) => i.id === productId));
  const removeItem = useCartStore((s) => s.removeItem);

  if (!item) return null;

  return (
    <div
      data-testid={`cart-item-${productId}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <span>{item.name}</span>
      <span data-testid={`cart-item-quantity-${productId}`} style={{ color: "#6b7280", fontSize: 14 }}>
        ×{item.quantity}
      </span>
      <span>${(item.price * item.quantity).toFixed(2)}</span>
      <button
        data-testid={`remove-from-cart-${productId}`}
        onClick={() => removeItem(productId)}
        style={{
          background: "none",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: 16,
        }}
        aria-label="Remove item"
      >
        ×
      </button>
    </div>
  );
}
