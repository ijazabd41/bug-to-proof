import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { generateProposal, parseModelProposalJson } from "./proposal";
import { createRunWorkspace, releaseWorkspaceLock } from "./workspace";
import { ARTIFACTS_DIR } from "../../utils/paths";

import { randomUUID } from "crypto";

describe("Dynamic AI Repair Proposal", () => {
  let testRunId: string;
  let ws: ReturnType<typeof createRunWorkspace>;

  beforeEach(() => {
    testRunId = "test-prop-" + randomUUID();
    ws = createRunWorkspace(testRunId);
  });

  afterEach(() => {
    releaseWorkspaceLock(ws);
    const runDir = path.join(ARTIFACTS_DIR, "runs", testRunId);
    if (fs.existsSync(runDir)) {
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("parses valid model proposal JSON and handles code fences", () => {
    const jsonWithFences = "```json\n" + JSON.stringify({
      diagnosis: "The cart total calculation ignores items after index 0.",
      assumptions: ["Items have price and quantity"],
      rationale: "Sum all items using reduce.",
      edits: [
        {
          relativePath: "src/store/cartStore.ts",
          oldContent: "total: () => get().items[0]?.price ?? 0,",
          newContent:
            "total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),",
        },
      ],
    }) + "\n```";

    const parsed = parseModelProposalJson(jsonWithFences);
    expect(parsed.diagnosis).toContain("cart total calculation");
    expect(parsed.edits.length).toBe(1);
    expect(parsed.edits[0].relativePath).toBe("src/store/cartStore.ts");
  });

  it("generates a validated proposal in simulated mode", async () => {
    const proposal = await generateProposal({
      caseTitle: "Cart reset bug",
      caseDescription: "Cart clear function needs explicit comment.",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      minishopDir: ws.minishopDir,
      config: {
        mode: "simulated",
        simulatedProposal: {
          diagnosis: "Cart clear needs descriptive comment",
          assumptions: ["Items array is reset"],
          rationale: "Add descriptive comment to clearCart",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // reset items",
            },
          ],
        },
      },
    });

    expect(proposal.proposalId).toBeDefined();
    expect(proposal.proposalHash).toHaveLength(64);
    expect(proposal.unifiedDiff).toContain("-  clearCart: () => set({ items: [] }),");
    expect(proposal.unifiedDiff).toContain("+  clearCart: () => set({ items: [] }), // reset items");
    expect(proposal.edits.length).toBe(1);
  });

  it("selects attempt-specific proposal when simulatedProposalsByAttempt is configured", async () => {
    const config = {
      mode: "simulated" as const,
      simulatedProposalsByAttempt: {
        1: {
          diagnosis: "Attempt 1 diagnosis",
          rationale: "Attempt 1 rationale",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // attempt 1",
            },
          ],
        },
        2: {
          diagnosis: "Attempt 2 diagnosis with refined fix",
          rationale: "Attempt 2 rationale",
          edits: [
            {
              relativePath: "src/store/cartStore.ts",
              oldContent: "  clearCart: () => set({ items: [] }),",
              newContent: "  clearCart: () => set({ items: [] }), // attempt 2 refined",
            },
          ],
        },
      },
    };

    const prop1 = await generateProposal({
      caseTitle: "Bug",
      caseDescription: "Desc",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      minishopDir: ws.minishopDir,
      attempt: 1,
      config,
    });

    const prop2 = await generateProposal({
      caseTitle: "Bug",
      caseDescription: "Desc",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      minishopDir: ws.minishopDir,
      attempt: 2,
      diagnostics: ["Attempt 1 failed regression checks"],
      config,
    });

    expect(prop1.diagnosis).toBe("Attempt 1 diagnosis");
    expect(prop1.unifiedDiff).toContain("+  clearCart: () => set({ items: [] }), // attempt 1");

    expect(prop2.diagnosis).toBe("Attempt 2 diagnosis with refined fix");
    expect(prop2.unifiedDiff).toContain("+  clearCart: () => set({ items: [] }), // attempt 2 refined");
    expect(prop1.proposalHash).not.toBe(prop2.proposalHash);
  });
});
