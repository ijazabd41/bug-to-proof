import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARTIFACTS_DIR, WORKSPACE_ROOT } from "../../utils/paths";
import { createRunWorkspace, releaseWorkspaceLock, startIsolatedMiniShop, stopIsolatedMiniShop } from "./workspace";

describe("isolated MiniShop server", () => {
  it("uses the Vite version resolved by MiniShop's own package", async () => {
    const requireFromMiniShop = createRequire(path.join(WORKSPACE_ROOT, "apps", "minishop", "package.json"));
    const expectedCli = path.join(path.dirname(requireFromMiniShop.resolve("vite/package.json")), "bin", "vite.js");
    const workspace = createRunWorkspace(`vite-resolution-${Date.now()}`);
    try {
      const app = await startIsolatedMiniShop(workspace);
      expect(path.normalize(app.process.spawnargs[1])).toBe(path.normalize(expectedCli));
    } finally {
      await stopIsolatedMiniShop(workspace);
      releaseWorkspaceLock(workspace);
      const runsRoot = path.join(ARTIFACTS_DIR, "runs") + path.sep;
      if (path.resolve(workspace.runDir).startsWith(path.resolve(runsRoot) + path.sep)) {
        fs.rmSync(workspace.runDir, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  }, 45_000);
});
