import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { CasesPage } from "./pages/CasesPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
import { Icon } from "./components/Icon";
import "./styles.css";

export default function App() {
  return <BrowserRouter><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-mark"><Icon name="proof" /></span><span>Bug-to-Proof</span></Link>
      <div className="sidebar-label">WORKSPACE</div>
      <nav aria-label="Main navigation"><NavLink to="/" className="nav-item"><Icon name="cases" />Bug cases<Icon name="arrow" /></NavLink></nav>
      <div className="sidebar-guide"><span className="sidebar-label">THE WORKFLOW</span><p>Every fix starts<br />with a proven failure.</p><ol><li>Report the behavior</li><li>Reproduce the failure</li><li>Review the patch</li><li>Verify with evidence</li></ol></div>
      <div className="sidebar-footer"><span className="local-dot" /><div><strong>Local workspace</strong><span>Evidence-backed repair</span></div></div>
    </aside>
    <div className="workspace">
      <header className="workspace-bar"><span><Icon name="cases" />Engineering workspace</span><span className="workspace-note"><Icon name="proof" />Proof over promises</span></header>
      <main id="main-content" className="main-content" tabIndex={-1}><Routes><Route path="/" element={<CasesPage />} /><Route path="/cases/:id" element={<CaseDetailPage />} /></Routes></main>
    </div>
  </div></BrowserRouter>;
}
