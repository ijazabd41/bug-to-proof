import { describe, it, expect } from "vitest";
import {
  computeProposalHash,
  validateProposalShape,
  validateReviewShape,
  ModelProposal,
  ProposalReview,
} from "./contracts";

describe("Dynamic AI Repair Contracts", () => {
  it("computes deterministic proposal hashes regardless of CRLF vs LF line endings", () => {
    const editsCRLF = [
      {
        relativePath: "apps\\minishop\\src\\store\\cartStore.ts",
        oldContent: "const x = 1;\r\nconst y = 2;",
        newContent: "const x = 1;\r\nconst y = 3;",
      },
    ];
    const editsLF = [
      {
        relativePath: "apps/minishop/src/store/cartStore.ts",
        oldContent: "const x = 1;\nconst y = 2;",
        newContent: "const x = 1;\nconst y = 3;",
      },
    ];

    const hash1 = computeProposalHash(editsCRLF, "Fix calculation", "Recalculate y correctly");
    const hash2 = computeProposalHash(editsLF, "Fix calculation", "Recalculate y correctly");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("changes hash when proposal content or diagnosis changes", () => {
    const edits = [
      {
        relativePath: "apps/minishop/src/store/cartStore.ts",
        oldContent: "const x = 1;",
        newContent: "const x = 2;",
      },
    ];

    const hash1 = computeProposalHash(edits, "Diagnosis A", "Rationale A");
    const hash2 = computeProposalHash(edits, "Diagnosis B", "Rationale A");

    expect(hash1).not.toBe(hash2);
  });

  it("validates valid and invalid ModelProposal shapes", () => {
    const validProposal: ModelProposal = {
      schemaVersion: "1.0",
      proposalId: "prop-001",
      diagnosis: "Cart total calculation ignores item quantities",
      assumptions: ["Items array is non-null"],
      rationale: "Multiply price by quantity for each item",
      edits: [
        {
          relativePath: "apps/minishop/src/store/cartStore.ts",
          oldContent: "total: () => get().items[0]?.price ?? 0,",
          newContent:
            "total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
        },
      ],
      unifiedDiff: "--- a/cartStore.ts\n+++ b/cartStore.ts\n",
      proposalHash: computeProposalHash(
        [
          {
            relativePath: "apps/minishop/src/store/cartStore.ts",
            oldContent: "total: () => get().items[0]?.price ?? 0,",
            newContent:
              "total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
          },
        ],
        "Cart total calculation ignores item quantities",
        "Multiply price by quantity for each item"
      ),
      proposedAt: new Date().toISOString(),
    };

    expect(validateProposalShape(validProposal)).toBe(true);
    expect(validateProposalShape({ ...validProposal, schemaVersion: "2.0" })).toBe(false);
    expect(validateProposalShape({ ...validProposal, edits: [] })).toBe(false);
    expect(validateProposalShape({ ...validProposal, proposalHash: "short-hash" })).toBe(false);
    expect(validateProposalShape(null)).toBe(false);
  });

  it("validates valid and invalid ProposalReview shapes", () => {
    const validReview: ProposalReview = {
      reviewId: "rev-001",
      proposalId: "prop-001",
      proposalHash: "a".repeat(64),
      decision: "APPROVED",
      reviewedAt: new Date().toISOString(),
    };

    expect(validateReviewShape(validReview)).toBe(true);
    expect(validateReviewShape({ ...validReview, decision: "INVALID_DECISION" as any })).toBe(false);
    expect(validateReviewShape({ ...validReview, proposalHash: "invalid" })).toBe(false);
    expect(validateReviewShape({})).toBe(false);
  });
});
