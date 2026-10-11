import fs from "fs";
import { ChildProcess } from "child_process";
import { terminateProcessTree } from "./workspace";

export interface ActiveRunResource {
  runId: string;
  abortController: AbortController;
  appProcess?: ChildProcess;
  childProcesses: Set<ChildProcess>;
  allocatedPort?: number;
  workspaceDir?: string;
  runDir?: string;
  lockPath?: string;
}

const registry = new Map<string, ActiveRunResource>();

/**
 * Registers an AbortController for an active repair run.
 */
export function registerRunController(runId: string, controller: AbortController): void {
  const res = registry.get(runId) ?? {
    runId,
    abortController: controller,
    childProcesses: new Set(),
  };
  res.abortController = controller;
  registry.set(runId, res);
}

/**
 * Registers the isolated MiniShop Vite app ChildProcess.
 */
export function registerAppProcess(runId: string, process: ChildProcess, port?: number): void {
  const res = registry.get(runId) ?? {
    runId,
    abortController: new AbortController(),
    childProcesses: new Set(),
  };
  res.appProcess = process;
  if (port) res.allocatedPort = port;
  registry.set(runId, res);
}

/**
 * Registers a generic child process (e.g. Playwright runner, regression check) for a run.
 */
export function registerChildProcess(runId: string, process: ChildProcess): void {
  const res = registry.get(runId);
  if (res) {
    res.childProcesses.add(process);
  }
}

/**
 * Unregisters a completed child process.
 */
export function unregisterChildProcess(runId: string, process: ChildProcess): void {
  const res = registry.get(runId);
  if (res) {
    res.childProcesses.delete(process);
  }
}

/**
 * Registers filesystem paths and lock file path for a run.
 */
export function registerWorkspacePaths(
  runId: string,
  paths: { runDir: string; workspaceDir: string; lockPath: string }
): void {
  const res = registry.get(runId) ?? {
    runId,
    abortController: new AbortController(),
    childProcesses: new Set(),
  };
  res.runDir = paths.runDir;
  res.workspaceDir = paths.workspaceDir;
  res.lockPath = paths.lockPath;
  registry.set(runId, res);
}

/**
 * Retrieves the active runtime resources for a run.
 */
export function getRunResources(runId: string): ActiveRunResource | undefined {
  return registry.get(runId);
}

/**
 * Cleans up all active runtime resources for a run:
 * 1. Signals the AbortController.
 * 2. Kills the isolated Vite app process tree on Windows.
 * 3. Kills any spawned runner or check child processes.
 * 4. Releases the run lock file.
 * Returns cleanup status and exposes any errors encountered.
 */
export async function cleanupRunResources(
  runId: string,
  reason?: string
): Promise<{ success: boolean; errors: string[] }> {
  const res = registry.get(runId);
  const errors: string[] = [];

  if (res) {
    // 1. Abort signal
    try {
      if (!res.abortController.signal.aborted) {
        res.abortController.abort(new Error(reason || "Run cancelled"));
      }
    } catch (err: any) {
      errors.push(`Abort controller error: ${err.message}`);
    }

    // 2. Kill app process tree
    if (res.appProcess) {
      try {
        await terminateProcessTree(res.appProcess);
        res.appProcess = undefined;
      } catch (err: any) {
        errors.push(`App process termination error: ${err.message}`);
      }
    }

    // 3. Kill all active child processes
    for (const child of res.childProcesses) {
      try {
        await terminateProcessTree(child);
      } catch (err: any) {
        errors.push(`Child process termination error: ${err.message}`);
      }
    }
    res.childProcesses.clear();

    // 4. Release lock path
    if (res.lockPath && fs.existsSync(res.lockPath)) {
      try {
        fs.unlinkSync(res.lockPath);
      } catch (err: any) {
        errors.push(`Lock release error: ${err.message}`);
      }
    }

    registry.delete(runId);
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Helper to clean up all registered runs (e.g. for test teardown or shutdown).
 */
export async function cleanupAllRuns(): Promise<void> {
  const runIds = Array.from(registry.keys());
  for (const runId of runIds) {
    await cleanupRunResources(runId, "Global cleanup");
  }
}
