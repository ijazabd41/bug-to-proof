import fs from "fs";
import path from "path";
import { ARTIFACTS_DIR } from "./paths";
import { isActiveRepairState } from "../ai/repair/contracts";

export interface CleanupCandidate {
  path: string;
  relativePath: string;
  type: "dir" | "file";
  sizeBytes: number;
  reason: string;
}

export interface ProtectedItem {
  relativePath: string;
  reason: string;
}

export function getDirectorySize(dir: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getDirectorySize(full);
      } else if (entry.isFile()) {
        size += fs.statSync(full).size;
      }
    }
  } catch {
    // ignore
  }
  return size;
}

export const PROTECTED_CURATED_DIRS = new Set([
  "evaluation",
  "system-testing",
  "portfolio-cart",
  "runner-regression",
]);

export async function runArtifactCleanup(options: { force?: boolean } = {}) {
  const isDryRun = !options.force;
  const resolvedArtifactsDir = path.resolve(ARTIFACTS_DIR);

  console.log("========================================================================");
  console.log(`   Artifact Hygiene & Storage Cleanup (${isDryRun ? "DRY-RUN DEFAULT" : "EXECUTE MODE"})`);
  console.log("========================================================================");
  console.log(`Artifacts Root: ${resolvedArtifactsDir}\n`);

  if (!fs.existsSync(resolvedArtifactsDir)) {
    console.log("Artifacts directory does not exist. Nothing to clean.");
    return;
  }

  const candidates: CleanupCandidate[] = [];
  const protectedItems: ProtectedItem[] = [];

  // Scan top-level directories under artifacts/
  const topEntries = fs.readdirSync(resolvedArtifactsDir, { withFileTypes: true });

  for (const entry of topEntries) {
    const fullPath = path.join(resolvedArtifactsDir, entry.name);

    // 1. Never delete .gitkeep
    if (entry.name === ".gitkeep") {
      protectedItems.push({ relativePath: entry.name, reason: "Placeholder marker" });
      continue;
    }

    // 2. Protect curated evidence directories
    if (PROTECTED_CURATED_DIRS.has(entry.name)) {
      protectedItems.push({ relativePath: entry.name, reason: "Curated historical evidence and reports" });
      continue;
    }

    // 3. Inspect runs directory
    if (entry.name === "runs" && entry.isDirectory()) {
      const runEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const runDirEntry of runEntries) {
        if (!runDirEntry.isDirectory()) continue;
        const runId = runDirEntry.name;
        const runDirPath = path.join(fullPath, runId);
        const runJsonPath = path.join(runDirPath, "run.json");
        const pinnedPath = path.join(runDirPath, ".pinned");

        // Check if run is pinned
        if (fs.existsSync(pinnedPath)) {
          protectedItems.push({ relativePath: `runs/${runId}`, reason: "Explicitly pinned evidence run" });
          continue;
        }

        // Check run state
        let isProtected = false;
        if (fs.existsSync(runJsonPath)) {
          try {
            const raw = fs.readFileSync(runJsonPath, "utf-8");
            const run = JSON.parse(raw);
            if (isActiveRepairState(run.state) || run.state === "AWAITING_REVIEW") {
              protectedItems.push({
                relativePath: `runs/${runId}`,
                reason: `Active / Awaiting-Review lifecycle state (${run.state})`,
              });
              isProtected = true;
            }
          } catch {
            // If corrupt run, protect for investigation
            protectedItems.push({ relativePath: `runs/${runId}`, reason: "Corrupt record preserved for audit" });
            isProtected = true;
          }
        }

        if (isProtected) {
          continue;
        }

        // For non-active runs, allow cleaning temporary workspaces and pristines
        const workspaceDir = path.join(runDirPath, "workspace");
        if (fs.existsSync(workspaceDir)) {
          const sz = getDirectorySize(workspaceDir);
          candidates.push({
            path: workspaceDir,
            relativePath: `runs/${runId}/workspace`,
            type: "dir",
            sizeBytes: sz,
            reason: "Temporary snapshot workspace cache",
          });
        }

        const pristineDir = path.join(runDirPath, "pristine");
        if (fs.existsSync(pristineDir)) {
          const sz = getDirectorySize(pristineDir);
          candidates.push({
            path: pristineDir,
            relativePath: `runs/${runId}/pristine`,
            type: "dir",
            sizeBytes: sz,
            reason: "Temporary pristine copy backup",
          });
        }
      }
      continue;
    }

    // 4. Temporary files (.tmp, .lock)
    if (entry.isFile() && (entry.name.endsWith(".tmp") || entry.name.endsWith(".lock"))) {
      const sz = fs.statSync(fullPath).size;
      candidates.push({
        path: fullPath,
        relativePath: entry.name,
        type: "file",
        sizeBytes: sz,
        reason: "Stale temporary file",
      });
      continue;
    }

    // Default protection for case directories
    if (entry.name.startsWith("case-")) {
      protectedItems.push({ relativePath: entry.name, reason: "Case execution evidence directory" });
    }
  }

  // Summary of Protected Items
  console.log(`Protected Items (${protectedItems.length}):`);
  for (const item of protectedItems) {
    console.log(`  ✓ [PROTECTED] ${item.relativePath} — ${item.reason}`);
  }

  // Summary of Cleanup Candidates
  console.log(`\nCleanup Candidates (${candidates.length}):`);
  let totalBytes = 0;
  for (const item of candidates) {
    totalBytes += item.sizeBytes;
    const mb = (item.sizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`  🗑 [${item.type.toUpperCase()}] ${item.relativePath} (${mb} MB) — ${item.reason}`);
  }

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\nTotal candidate space to reclaim: ${totalMb} MB (${totalBytes} bytes)`);

  if (isDryRun) {
    console.log("\n[DRY RUN COMPLETE] No files were removed. Use `npm run artifacts:clean -- --force` to delete.");
  } else {
    console.log("\n[EXECUTING DELETION] Removing candidate files...");
    let deletedCount = 0;
    for (const item of candidates) {
      // Security check: verify path is strictly inside ARTIFACTS_DIR
      const resolved = path.resolve(item.path);
      if (!resolved.startsWith(resolvedArtifactsDir) || resolved === resolvedArtifactsDir) {
        console.error(`[SECURITY ERROR] Path traversal attempt detected: ${resolved}. Aborting.`);
        continue;
      }
      try {
        if (item.type === "dir") {
          fs.rmSync(resolved, { recursive: true, force: true });
        } else {
          fs.unlinkSync(resolved);
        }
        deletedCount++;
        console.log(`  ✓ Removed: ${item.relativePath}`);
      } catch (err: any) {
        console.error(`  ✗ Error removing ${item.relativePath}:`, err.message);
      }
    }
    console.log(`\nCleanup completed. Removed ${deletedCount} items (${totalMb} MB freed).`);
  }
}
