import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { CasesPage } from "./pages/CasesPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
import { Icon } from "./components/Icon";
import "./styles.css";

export default function App() {
  return <BrowserRouter><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="workspace">
      <header className="workspace-bar">
        <Link to="/" className="brand"><span className="brand-mark"><Icon name="proof" /></span><span>proofline<span className="brand-period">.</span></span></Link>
        <nav aria-label="Main navigation"><NavLink to="/" end className="nav-item">Cases</NavLink></nav>
        <span className="workspace-note"><span className="local-dot" />Local workspace</span>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}><Routes><Route path="/" element={<CasesPage />} /><Route path="/cases/:id" element={<CaseDetailPage />} /></Routes></main>
    </div>
  </div></BrowserRouter>;
}
