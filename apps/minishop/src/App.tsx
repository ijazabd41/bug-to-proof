import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ShopPage } from "./pages/ShopPage";
import { CartPage } from "./pages/CartPage";
import { useCartStore } from "./store/cartStore";

function NavBar() {
  const items = useCartStore((s) => s.items);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <header
      style={{
        marginBottom: 32,
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1f2937" }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            🛒 MiniShop
          </Link>
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
          Demo store for Bug-to-Proof
        </p>
      </div>
      <Link
        to="/cart"
        data-testid="nav-cart-link"
        style={{
          textDecoration: "none",
          color: "#3b82f6",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Cart{itemCount > 0 ? ` (${itemCount})` : ""}
      </Link>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<ShopPage />} />
          <Route path="/cart" element={<CartPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
