import React, { useState } from "react";
import { useCartStore } from "../store/cartStore";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const shipping = useCartStore((s) => s.shipping);
  const promoCode = useCartStore((s) => s.promoCode);
  const applyPromoCode = useCartStore((s) => s.applyPromoCode);
  const clearCart = useCartStore((s) => s.clearCart);

  const [inputCode, setInputCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  const cartTotal = total();
  const shippingFee = shipping();

  const handleApplyPromo = async () => {
    if (!inputCode.trim()) return;
    const ok = await applyPromoCode(inputCode);
    if (ok) {
      setPromoMessage("Promo code applied!");
    } else {
      setPromoMessage("Invalid promo code");
    }
  };

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

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <input
              data-testid="promo-input"
              type="text"
              placeholder="Promo code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
            />
            <button
              data-testid="apply-promo-button"
              onClick={handleApplyPromo}
              style={{
                padding: "6px 12px",
                background: "#4b5563",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Apply
            </button>
          </div>
          {promoMessage && (
            <p data-testid="promo-status" role="status" style={{ fontSize: 12, color: promoCode ? "#059669" : "#dc2626", marginTop: 4 }}>
              {promoMessage}
            </p>
          )}

          <div
            style={{
              marginTop: 12,
              paddingTop: 8,
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#4b5563",
            }}
          >
            <span>Shipping</span>
            <span data-testid="shipping-fee">${shippingFee.toFixed(2)}</span>
          </div>

          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
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
