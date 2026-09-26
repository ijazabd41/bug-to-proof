import React from "react";
import { useCartStore } from "../store/cartStore";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const clearCart = useCartStore((s) => s.clearCart);

  const cartTotal = total();

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "16px",
        background: "#fff",
        minWidth: 280,
      }}
    >
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Cart</h2>

      {items.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Your cart is empty.</p>
      ) : (
        <>
          {items.map((item) => (
            <CartItem key={item.id} productId={item.id} />
          ))}

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "2px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            <span>Total</span>
            <span data-testid="cart-total">${cartTotal.toFixed(2)}</span>
          </div>

          <button
            data-testid="checkout-button"
            onClick={clearCart}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "10px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Checkout
          </button>
        </>
      )}
    </div>
  );
}
