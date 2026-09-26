import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { CasesPage } from "./pages/CasesPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <header
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1f2328" }}>
              🔍 Bug-to-Proof
            </span>
          </Link>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Reported → Reproduced → Patched → Verified
          </span>
        </header>

        <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
          <Routes>
            <Route path="/" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
