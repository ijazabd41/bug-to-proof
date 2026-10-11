import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import {
  validateEdits,
  generateUnifiedDiff,
  applyEditsTransactionally,
  isAllowedEditablePath,
} from "./patchPolicy";
import { createRunWorkspace, releaseWorkspaceLock } from "./workspace";
import { ARTIFACTS_DIR } from "../../utils/paths";

import { randomUUID } from "crypto";

describe("Dynamic AI Repair Patch Policy", () => {
  let testRunId: string;
  let ws: ReturnType<typeof createRunWorkspace>;

  beforeEach(() => {
    testRunId = "test-policy-" + randomUUID();
    ws = createRunWorkspace(testRunId);
  });

  afterEach(() => {
    releaseWorkspaceLock(ws);
    const runDir = path.join(ARTIFACTS_DIR, "runs", testRunId);
    if (fs.existsSync(runDir)) {
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        // ignore Windows file lock latency
      }
    }
  });

  it("checks allowed editable paths correctly", () => {
    expect(isAllowedEditablePath("src/store/cartStore.ts")).toBe(true);
    expect(isAllowedEditablePath("apps/minishop/src/App.tsx")).toBe(true);
    expect(isAllowedEditablePath("src/store/cartStore.test.ts")).toBe(false);
    expect(isAllowedEditablePath("vite.config.ts")).toBe(false);
    expect(isAllowedEditablePath("package.json")).toBe(false);
  });

  it("validates valid edits and rejects invalid or ambiguous edits", () => {
    const validEdit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    expect(validateEdits(ws.minishopDir, validEdit).valid).toBe(true);

    const missingContentEdit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "non_existent_code_snippet_xyz",
        newContent: "something else",
      },
    ];
    expect(validateEdits(ws.minishopDir, missingContentEdit).valid).toBe(false);

    const forbiddenPathEdit = [
      {
        relativePath: "package.json",
        oldContent: `"name": "@bug-to-proof/minishop"`,
        newContent: `"name": "@bug-to-proof/hacked"`,
      },
    ];
    expect(validateEdits(ws.minishopDir, forbiddenPathEdit).valid).toBe(false);
  });

  it("generates unified diff for valid edits", () => {
    const edit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    const diff = generateUnifiedDiff(ws.minishopDir, edit);
    expect(diff).toContain("--- a/src/store/cartStore.ts");
    expect(diff).toContain("+++ b/src/store/cartStore.ts");
    expect(diff).toContain("-  clearCart: () => set({ items: [] }),");
    expect(diff).toContain("+  clearCart: () => set({ items: [] }), // reset items");
  });

  it("applies edits transactionally to isolated workspace and preserves primary source", () => {
    const edit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    const result = applyEditsTransactionally(ws.minishopDir, edit);
    expect(result.success).toBe(true);
    expect(result.modifiedFiles).toContain("src/store/cartStore.ts");

    const updatedContent = fs.readFileSync(
      path.join(ws.minishopDir, "src", "store", "cartStore.ts"),
      "utf-8"
    );
    expect(updatedContent).toContain("clearCart: () => set({ items: [] }), // reset items");
  });
});
