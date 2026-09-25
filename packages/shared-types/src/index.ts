/**
 * @bug-to-proof/shared-types
 *
 * Single source of truth for all TypeScript types shared across the monorepo.
 *
 * ⚠️  FROZEN after Milestone 0.
 * All three team members agreed on this contract before parallel development began.
 * Do not change without team sign-off.
 *
 * Owners:
 *   - Abdullah Ijaz  (API + LLM)
 *   - Sikander        (Dashboard)
 *   - Rida Zainab    (MiniShop + Playwright)
 */

// ── Status enums ─────────────────────────────────────────────────────────────

export type CaseStatus =
  | "REPORTED"
  | "READY_TO_REPRODUCE"
  | "REPRODUCING"
  | "REPRODUCED"
  | "REPRODUCTION_FAILED"
  | "PATCH_PROPOSED"
  | "PATCH_APPLIED"
  | "VERIFYING"
  | "VERIFIED"
  | "VERIFICATION_FAILED";

export type EvidenceType = "screenshot" | "trace" | "video" | "result-json";

export type EvidencePhase = "before" | "after";

export type PatchStatus = "PROPOSED" | "APPLIED" | "REJECTED";

export type VerificationStatus = "PENDING" | "VERIFIED" | "VERIFICATION_FAILED";

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface Evidence {
  /** Unique evidence item ID, e.g. "ev-001" */
  id: string;
  type: EvidenceType;
  phase: EvidencePhase;
  /** Relative path from workspace root, e.g. "artifacts/case-001/before/screenshot.png" */
  path: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  description: string;
}

// ── Test run (single Playwright execution result) ─────────────────────────────

export interface TestRun {
  /** ISO 8601 timestamp of when the run completed */
  runAt: string;
  passed: boolean;
  /** Human-readable expected outcome, e.g. "Cart total displays $30.00" */
  expected: string;
  /** Human-readable actual outcome, e.g. "Cart total displays $10.00" */
  actual: string;
  durationMs: number;
  /** IDs from the Evidence array on the parent BugCase */
  evidenceIds: string[];
}

// ── Reproduction ──────────────────────────────────────────────────────────────

export interface Reproduction {
  preconditions: string[];
  steps: string[];
  /** What should happen */
  expected: string;
  /** What actually happens */
  actual: string;
  /** Path to the Playwright spec file, e.g. "tests/playwright/cases/case-001-cart-total.spec.ts" */
  testFile: string;
  lastRun: TestRun | null;
}

// ── Patch ─────────────────────────────────────────────────────────────────────

export interface Patch {
  /** One-sentence description of the change (LLM-generated or manual) */
  summary: string;
  /** 2-3 sentence explanation of why this diff fixes the bug (LLM-generated or manual) */
  reasoning: string;
  filesChanged: string[];
  /** Unified diff text */
  diff: string;
  status: PatchStatus;
  /** ISO 8601 */
  proposedAt: string;
  /** ISO 8601, null until applied */
  appliedAt: string | null;
}

// ── Verification ──────────────────────────────────────────────────────────────

export interface VerificationComparison {
  statusChanged: boolean;
  beforeStatus: "PASSED" | "FAILED" | null;
  afterStatus: "PASSED" | "FAILED" | null;
}

export interface Verification {
  status: VerificationStatus;
  beforeRun: TestRun | null;
  afterRun: TestRun | null;
  comparison: VerificationComparison | null;
}

// ── BugCase (top-level entity) ────────────────────────────────────────────────

export interface BugCase {
  /** Unique case ID, e.g. "case-001" */
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  reproduction: Reproduction | null;
  patch: Patch | null;
  verification: Verification | null;
  evidence: Evidence[];
  /**
   * LLM-generated root cause explanation paragraph.
   * Populated when case transitions to REPRODUCED.
   * null if LLM is disabled or call failed.
   */
  rootCauseExplanation: string | null;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}

export interface RunTriggerResponse {
  message: string;
  caseId: string;
}

// ── MiniShop data-testid contract ─────────────────────────────────────────────
// These are the agreed data-testid values used in MiniShop (Rida Zainab)
// and referenced in Playwright specs (Rida Zainab) and the dashboard (Sikander).
//
//   add-to-cart-{productId}         e.g.  data-testid="add-to-cart-1"
//   cart-total                             data-testid="cart-total"
//   cart-item-{productId}           e.g.  data-testid="cart-item-1"
//   cart-item-quantity-{productId}  e.g.  data-testid="cart-item-quantity-1"
//   checkout-button                        data-testid="checkout-button"
//
// Exported as constants so specs and helpers import them rather than using magic strings.

export const TEST_IDS = {
  addToCart: (productId: number | string) => `add-to-cart-${productId}`,
  cartTotal: "cart-total",
  cartItem: (productId: number | string) => `cart-item-${productId}`,
  cartItemQuantity: (productId: number | string) => `cart-item-quantity-${productId}`,
  checkoutButton: "checkout-button",
} as const;
