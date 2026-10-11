import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  createRunWorkspace,
  releaseWorkspaceLock,
  getAvailablePort,
  restoreOriginalWorkspace,
} from "./workspace";
import { ARTIFACTS_DIR } from "../../utils/paths";

describe("Dynamic AI Repair Workspace", () => {
  const testRunId = "test-ws-" + Date.now();
  const runDir = path.join(ARTIFACTS_DIR, "runs", testRunId);

  afterEach(() => {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  });

  it("creates an isolated workspace snapshot with computed source manifest", () => {
    const ws = createRunWorkspace(testRunId);
    expect(fs.existsSync(ws.workspaceDir)).toBe(true);
    expect(fs.existsSync(ws.minishopDir)).toBe(true);
    expect(fs.existsSync(path.join(ws.minishopDir, "src", "store", "cartStore.ts"))).toBe(true);
    expect(ws.sourceManifest.length).toBeGreaterThan(0);
    expect(ws.originalSourceFingerprint).toHaveLength(64);
    expect(fs.existsSync(ws.lockPath)).toBe(true);

    releaseWorkspaceLock(ws);
    expect(fs.existsSync(ws.lockPath)).toBe(false);
  });

  it("finds an available port", async () => {
    const port = await getAvailablePort(5200);
    expect(port).toBeGreaterThanOrEqual(5200);
  });

  it("restores original pristine workspace snapshot after modification", () => {
    const ws = createRunWorkspace(testRunId + "-restore");
    const testFilePath = path.join(ws.minishopDir, "src", "store", "cartStore.ts");
    const originalContent = fs.readFileSync(testFilePath, "utf-8");

    // Modify file
    fs.writeFileSync(testFilePath, originalContent + "\n// temporary mutation for test");

    // Restore workspace
    restoreOriginalWorkspace(ws);

    const restoredContent = fs.readFileSync(testFilePath, "utf-8");
    expect(restoredContent).toBe(originalContent);

    releaseWorkspaceLock(ws);
    const cleanupDir = path.join(ARTIFACTS_DIR, "runs", testRunId + "-restore");
    if (fs.existsSync(cleanupDir)) {
      fs.rmSync(cleanupDir, { recursive: true, force: true });
    }
  });
});
