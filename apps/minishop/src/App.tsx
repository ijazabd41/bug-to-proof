import React from "react";
import { ShopPage } from "./pages/ShopPage";

export default function App() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ marginBottom: 32, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1f2937" }}>
          🛒 MiniShop
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
          Demo store for Bug-to-Proof
        </p>
      </header>
      <ShopPage />
    </div>
  );
}
