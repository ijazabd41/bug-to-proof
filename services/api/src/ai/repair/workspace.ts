import fs from "fs";
import path from "path";
import net from "net";
import { spawn, exec, ChildProcess } from "child_process";
import { createHash } from "crypto";
import { createRequire } from "module";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../../utils/paths";
import {
  registerAppProcess,
  registerWorkspacePaths,
  getRunResources,
} from "./runtimeRegistry";

export interface SourceFileInfo {
  relativePath: string;
  hash: string;
}

export interface RunWorkspace {
  runId: string;
  runDir: string;
  workspaceDir: string;
  minishopDir: string;
  pristineMinishopDir: string;
  sourceManifest: SourceFileInfo[];
  originalSourceFingerprint: string;
  expectedPatchedFingerprint?: string;
  port?: number;
  url?: string;
  lockPath: string;
}

export const digest = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");

export async function getAvailablePort(preferredPort?: number): Promise<number> {
  const basePort = preferredPort ?? (5200 + Math.floor(Math.random() * 1000));
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      resolve(getAvailablePort(basePort + 1));
    });
    server.listen(basePort, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

export async function waitForReachability(
  url: string,
  timeoutMs = 15000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status === 200 || res.status === 304) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

export function terminateProcessTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }
    if (process.platform === "win32") {
      exec(`taskkill /pid ${child.pid} /T /F`, () => {
        resolve();
      });
    } else {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve();
    }
  });
}

function copyDirRecursive(
  src: string,
  dest: string,
  excludePatterns: string[] = ["node_modules", ".git", "dist", ".env"]
) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludePatterns.some((pattern) => entry.name === pattern || entry.name.startsWith(".env"))) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludePatterns);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function computeSourceManifest(minishopDir: string): {
  manifest: SourceFileInfo[];
  fingerprint: string;
} {
  const manifest: SourceFileInfo[] = [];
  const srcDir = path.join(minishopDir, "src");

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|css|html|json)$/.test(entry.name)) {
        const rel = path.relative(minishopDir, fullPath).replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath);
        manifest.push({
          relativePath: rel,
          hash: digest(content),
        });
      }
    }
  }

  scan(srcDir);
  manifest.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const fingerprint = digest(JSON.stringify(manifest));
  return { manifest, fingerprint };
}

export function createRunWorkspace(runId: string): RunWorkspace {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) {
    throw new Error("Invalid run ID");
  }

  const runDir = path.join(ARTIFACTS_DIR, "runs", runId);
  const workspaceDir = path.join(runDir, "workspace");
  const minishopDest = path.join(workspaceDir, "apps", "minishop");
  const minishopPristine = path.join(workspaceDir, "apps", "minishop-pristine");
  const lockPath = path.join(runDir, "run.lock");

  fs.mkdirSync(workspaceDir, { recursive: true });

  // Acquire lock
  if (fs.existsSync(lockPath)) {
    throw new Error(`Run ${runId} is currently locked by another process`);
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, lockedAt: new Date().toISOString() }));

  // Copy minishop app source to working snapshot and pristine backup
  const minishopSrc = path.join(WORKSPACE_ROOT, "apps", "minishop");
  copyDirRecursive(minishopSrc, minishopDest);
  copyDirRecursive(minishopSrc, minishopPristine);

  // Copy tsconfig.base.json so Vite/OXC can resolve extends "../../tsconfig.base.json"
  const tsconfigBase = path.join(WORKSPACE_ROOT, "tsconfig.base.json");
  if (fs.existsSync(tsconfigBase)) {
    fs.copyFileSync(tsconfigBase, path.join(workspaceDir, "tsconfig.base.json"));
  }

  // Copy packages (e.g. shared-types) so local workspace references resolve
  const packagesSrc = path.join(WORKSPACE_ROOT, "packages");
  if (fs.existsSync(packagesSrc)) {
    copyDirRecursive(packagesSrc, path.join(workspaceDir, "packages"));
  }

  // Compute manifest
  const { manifest, fingerprint } = computeSourceManifest(minishopDest);

  // Save source manifest
  fs.writeFileSync(
    path.join(runDir, "source-manifest.json"),
    JSON.stringify({ fingerprint, files: manifest }, null, 2)
  );

  const ws: RunWorkspace = {
    runId,
    runDir,
    workspaceDir,
    minishopDir: minishopDest,
    pristineMinishopDir: minishopPristine,
    sourceManifest: manifest,
    originalSourceFingerprint: fingerprint,
    lockPath,
  };

  registerWorkspacePaths(runId, { runDir, workspaceDir, lockPath });
  return ws;
}

export function restoreOriginalWorkspace(workspace: RunWorkspace): void {
  if (!fs.existsSync(workspace.pristineMinishopDir)) {
    throw new Error(`Pristine backup not found at ${workspace.pristineMinishopDir}`);
  }

  // Restore minishop working directory from pristine copy
  copyDirRecursive(workspace.pristineMinishopDir, workspace.minishopDir);

  // Verify restored fingerprint matches originalSourceFingerprint
  const { fingerprint } = computeSourceManifest(workspace.minishopDir);
  if (fingerprint !== workspace.originalSourceFingerprint) {
    throw new Error(
      `Restored workspace fingerprint mismatch. Expected ${workspace.originalSourceFingerprint}, got ${fingerprint}`
    );
  }
}

export async function startIsolatedMiniShop(
  workspace: RunWorkspace,
  customPort?: number
): Promise<{ port: number; url: string; process: ChildProcess }> {
  const port = customPort ?? (await getAvailablePort());
  const url = `http://127.0.0.1:${port}`;

  const requireFromMiniShop = createRequire(path.join(WORKSPACE_ROOT, "apps", "minishop", "package.json"));
  const viteCli = path.join(path.dirname(requireFromMiniShop.resolve("vite/package.json")), "bin", "vite.js");
  const configPath = path.join(workspace.minishopDir, "vite.config.ts");

  let startupLogs = "";
  const child = spawn(
    process.execPath,
    [
      viteCli,
      workspace.minishopDir,
      "--config",
      configPath,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "development",
      },
      stdio: "pipe",
    }
  );

  child.stdout?.on("data", (d) => {
    startupLogs += d.toString();
  });
  child.stderr?.on("data", (d) => {
    startupLogs += d.toString();
  });

  workspace.port = port;
  workspace.url = url;

  registerAppProcess(workspace.runId, child, port);

  // Wait for reachability
  const isUp = await waitForReachability(url, 30000);
  if (!isUp) {
    await terminateProcessTree(child);
    throw new Error(
      `Isolated MiniShop failed to become reachable at ${url} within 30 seconds. Logs:\n${startupLogs}`
    );
  }

  return { port, url, process: child };
}

export async function stopIsolatedMiniShop(workspace: RunWorkspace): Promise<void> {
  const res = getRunResources(workspace.runId);
  if (res?.appProcess) {
    await terminateProcessTree(res.appProcess);
    res.appProcess = undefined;
  }
}

export function releaseWorkspaceLock(workspace: RunWorkspace): void {
  if (workspace.lockPath && fs.existsSync(workspace.lockPath)) {
    try {
      fs.unlinkSync(workspace.lockPath);
    } catch {
      // ignore
    }
  }
}
