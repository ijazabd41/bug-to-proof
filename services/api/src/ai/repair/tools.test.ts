import { describe, it, expect } from "vitest";
import path from "path";
import {
  listSourceFiles,
  readSourceFile,
  searchSourceFiles,
} from "./tools";
import { WORKSPACE_ROOT } from "../../utils/paths";

describe("Dynamic AI Repair Tools", () => {
  const minishopDir = path.join(WORKSPACE_ROOT, "apps", "minishop");

  it("lists only non-test source files under src/", () => {
    const files = listSourceFiles(minishopDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith("cartStore.ts"))).toBe(true);
    // Should NOT contain test files
    expect(files.some((f) => f.includes(".test."))).toBe(false);
  });

  it("reads a source file within limits", () => {
    const file = readSourceFile(minishopDir, "src/store/cartStore.ts");
    expect(file.relativePath).toBe("src/store/cartStore.ts");
    expect(file.content).toContain("useCartStore");
    expect(file.lines).toBeGreaterThan(10);
    expect(file.truncated).toBe(false);
  });

  it("prevents directory traversal and reading non-src files", () => {
    expect(() => readSourceFile(minishopDir, "../package.json")).toThrow();
    expect(() => readSourceFile(minishopDir, "vite.config.ts")).toThrow();
  });

  it("searches source files for text pattern", () => {
    const matches = searchSourceFiles(minishopDir, "useCartStore");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].lineContent).toContain("useCartStore");
  });
});
