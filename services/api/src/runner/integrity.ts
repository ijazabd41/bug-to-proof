import fs from "fs";
import { classifyReport } from "./classification";
import path from "path";
import { createHash } from "crypto";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../utils/paths";
import type { BugCase, TestRun } from "@bug-to-proof/shared-types";

export const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export function resolveTest(testFile: string): string {
  const root = path.join(WORKSPACE_ROOT, "tests/playwright/cases");
  const file = path.resolve(WORKSPACE_ROOT, testFile);
  if (!file.startsWith(root + path.sep) || !file.endsWith(".spec.ts") || !fs.statSync(file).isFile()) {
    throw new Error("Test must be a local spec under tests/playwright/cases");
  }
  const real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(root) + path.sep)) throw new Error("Test path escapes local cases");
  return real;
}
/** Conservatively bind specs, helpers, config, shared IDs, and runtime. */
export function testFingerprint(testFile: string): string {
  const selected = resolveTest(testFile);
  const files: string[] = [];
  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Symlinked test input is unsupported");
      if (entry.isDirectory()) visit(file);
      else if (/\.(ts|json)$/.test(file)) files.push(file);
    }
  }
  visit(path.join(WORKSPACE_ROOT, "tests/playwright"));
  files.push(path.join(WORKSPACE_ROOT, "packages/shared-types/src/index.ts"));
  const inputs = files.sort().map((file) => [path.relative(WORKSPACE_ROOT, file), digest(fs.readFileSync(file))]);
  return digest(JSON.stringify({ selected: path.relative(WORKSPACE_ROOT, selected), inputs,
    runtime: process.version, timeout: process.env.PLAYWRIGHT_TIMEOUT ?? "30000",
    playwright: JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "node_modules/@playwright/test/package.json"), "utf8")).version,
  }));
}
export function validBaseline(bugCase: BugCase): boolean {
  const run = bugCase.verification?.beforeRun;
  if (!run || run.passed || run.outcome !== "ASSERTION_FAILED" || !run.testFingerprint || !run.runId || !run.reportHash || !run.testIds?.length) return false;
  try {
    if (run.testFingerprint !== testFingerprint(bugCase.reproduction!.testFile)) return false;
    const dir = path.join(ARTIFACTS_DIR, bugCase.id, "before", run.runId);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const report = fs.readFileSync(path.join(dir, "result.json"), "utf8");
    const classified = classifyReport(JSON.parse(report), manifest.exitCode);
    return classified.outcome === "ASSERTION_FAILED" && JSON.stringify(classified.testIds) === JSON.stringify(run.testIds) &&
      manifest.outcome === "ASSERTION_FAILED" && manifest.testFingerprint === run.testFingerprint &&
      manifest.reportHash === run.reportHash && digest(fs.readFileSync(path.join(dir, "result.json"))) === run.reportHash &&
      JSON.stringify(manifest.testIds) === JSON.stringify(run.testIds);
  } catch { return false; }
}
export function sameTests(before: TestRun, after: TestRun): boolean {
  return !!before.testFingerprint && before.testFingerprint === after.testFingerprint &&
    !!before.testIds?.length && JSON.stringify(before.testIds) === JSON.stringify(after.testIds);
}
