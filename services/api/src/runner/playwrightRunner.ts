import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../utils/paths";
import { digest, resolveTest, testFingerprint } from "./integrity";
export { digest, resolveTest, testFingerprint } from "./integrity";
import { registerChildProcess, unregisterChildProcess } from "../ai/repair/runtimeRegistry";
import { terminateProcessTree } from "../ai/repair/workspace";

export interface RunResult {
  exitCode?: number | null;
  passed: boolean;
  outcome: "PASSED" | "ASSERTION_FAILED" | "INFRASTRUCTURE_ERROR";
  failureKind?: ExecutionFailureKind;
  expected: string;
  actual: string;
  durationMs: number;
  runId: string;
  testFingerprint: string;
  testIds: string[];
  reportHash?: string;
  artifactPaths: { screenshot?: string; trace?: string; resultJson?: string };
  rawOutput: string;
}
export type ExecutionFailureKind = "TARGET_UNREACHABLE" | "BROWSER_UNAVAILABLE" | "EXECUTION_TIMEOUT" | "CANCELLED" | "SELECTOR_OR_ACTION_ERROR" | "INVALID_REPORT" | "INPUTS_CHANGED";
import { classifyReport } from "./classification";
export { classifyReport } from "./classification";
export interface RunTestOptions {
  targetUrl?: string;
  artifactDir?: string;
  timeoutMs?: number;
  runId?: string;
  abortSignal?: AbortSignal;
  /** Explicit containment root for transient compiler-owned specs. Never set for configured benchmark tests. */
  generatedTestRoot?: string;
}

export async function runTest(
  caseId: string,
  testFile: string,
  phase: "before" | "after",
  options?: RunTestOptions
): Promise<RunResult> {
  if (!/^[a-zA-Z0-9-]{1,50}$/.test(caseId)) throw new Error("Invalid case ID");
  const generatedRoot = options?.generatedTestRoot ? path.resolve(options.generatedTestRoot) : undefined;
  const file = generatedRoot ? resolveGeneratedTest(testFile, generatedRoot) : resolveTest(testFile);
  if (generatedRoot) trustedGeneratedPlaywrightConfig(path.dirname(file));
  const fingerprint = generatedRoot ? generatedTestFingerprint(file) : testFingerprint(testFile);
  const runId = options?.runId ?? randomUUID();
  const targetUrl = options?.targetUrl ?? process.env.MINISHOP_BASE_URL ?? "http://localhost:5174";
  const artifactDir = options?.artifactDir ?? path.join(ARTIFACTS_DIR, caseId, phase, runId);
  fs.mkdirSync(artifactDir, { recursive: true });
  const start = Date.now();
  const base: RunResult = { passed: false, outcome: "INFRASTRUCTURE_ERROR", expected: "", actual: "", durationMs: 0,
    runId, testFingerprint: fingerprint, testIds: [], artifactPaths: {}, rawOutput: "" };
  function record(result: RunResult, report?: any): RunResult {
    try {
      if ((generatedRoot ? generatedTestFingerprint(file) : testFingerprint(testFile)) !== fingerprint) throw new Error("changed");
    } catch {
      result.outcome = "INFRASTRUCTURE_ERROR"; result.failureKind = "INPUTS_CHANGED"; result.passed = false; result.actual = "Test inputs changed during execution";
    }
    fs.writeFileSync(path.join(artifactDir, "output.log"), result.rawOutput);
    if (report) {
      const json = JSON.stringify(report, null, 2);
      fs.writeFileSync(path.join(artifactDir, "result.json"), json);
      result.reportHash = digest(json);
      result.artifactPaths.resultJson = safeArtifactReference(path.join(artifactDir, "result.json"), artifactDir);
      const attachments = (suite: any): any[] => [
        ...(suite.specs ?? []).flatMap((s: any) => (s.tests ?? []).flatMap((t: any) => (t.results ?? []).flatMap((r: any) => r.attachments ?? []))),
        ...(suite.suites ?? []).flatMap(attachments),
      ];
      for (const attachment of (report.suites ?? []).flatMap(attachments)) {
        if (!attachment.path) continue;
        const target = path.resolve(attachment.path);
        if (!target.startsWith(artifactDir + path.sep) || !fs.existsSync(target)) continue;
        const key = attachment.name === "trace" ? "trace" : attachment.contentType === "image/png" ? "screenshot" : null;
        if (key && !result.artifactPaths[key]) result.artifactPaths[key] = safeArtifactReference(target, artifactDir);
      }
    }
    fs.writeFileSync(path.join(artifactDir, "manifest.json"), JSON.stringify(result, null, 2));
    return result;
  }
  if (options?.abortSignal?.aborted) {
    return record({ ...base, failureKind: "CANCELLED", actual: "Execution aborted before starting", durationMs: Date.now() - start });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(targetUrl, { method: "GET", signal: controller.signal });
    if (!response.ok) throw new Error(`MiniShop HTTP ${response.status}`);
  } catch (error) {
    return record({ ...base, failureKind: "TARGET_UNREACHABLE", actual: `MiniShop is not reachable at ${targetUrl}`, rawOutput: String(error), durationMs: Date.now() - start });
  } finally { clearTimeout(timer); }
  return new Promise((resolve) => {
    let stdout = "", stderr = "", settled = false; let watchdog: ReturnType<typeof setTimeout>;
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const configFile = generatedRoot ? trustedGeneratedPlaywrightConfig(path.dirname(file)) : "tests/playwright/playwright.config.ts";
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config",
      configFile, path.relative(WORKSPACE_ROOT, file).replace(/\\/g, "/"),
      "--reporter=json", "--output", artifactDir], {
      cwd: WORKSPACE_ROOT, shell: false,
      env: {
        ...process.env,
        PHASE: phase,
        CASE_ID: caseId,
        BTP_ARTIFACT_DIR: artifactDir,
        MINISHOP_BASE_URL: targetUrl,
      },
    });
    if (options?.runId) {
      registerChildProcess(options.runId, child);
    }
    const cleanupChild = () => {
      if (options?.runId) {
        unregisterChildProcess(options.runId, child);
      }
    };
    const finish = (result: RunResult, report?: any) => {
      if (!settled) {
        settled = true;
        clearTimeout(watchdog);
        cleanupChild();
        resolve(record(result, report));
      }
    };
    let abortListener: (() => void) | undefined;
    if (options?.abortSignal) {
      abortListener = async () => {
        if (!settled) {
          await terminateProcessTree(child);
          finish({ ...base, failureKind: "CANCELLED", actual: "Evidence runner was cancelled by abort signal", rawOutput: stdout + "\n" + stderr, durationMs: Date.now() - start });
        }
      };
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }
    watchdog = setTimeout(async () => {
      await terminateProcessTree(child);
      finish({ ...base, failureKind: "EXECUTION_TIMEOUT", actual: `Evidence runner exceeded its ${Math.round(timeoutMs / 1000)}-second limit`, rawOutput: stdout + "\n" + stderr, durationMs: Date.now() - start });
    }, timeoutMs);
    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    child.on("error", (error) => finish({ ...base, actual: `Runner spawn error: ${error.message}`, rawOutput: error.message, durationMs: Date.now() - start }));
    child.on("close", (code) => {
      const result = { ...base, exitCode: code, durationMs: Date.now() - start, rawOutput: stdout + "\n" + stderr };
      try {
        const report = JSON.parse(stdout.slice(stdout.indexOf("{")));
        const classification = classifyReport(report, code);
        finish({ ...result, ...classification, passed: classification.outcome === "PASSED" }, report);
      } catch { finish({ ...result, failureKind: "INVALID_REPORT", actual: "Invalid or missing Playwright JSON report" }); }
    });
  });
}

function resolveGeneratedTest(testFile: string, generatedRoot: string): string {
  const file = path.resolve(testFile);
  if (!file.startsWith(`${generatedRoot}${path.sep}`) || !file.endsWith(".spec.ts") || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error("Generated test must be a contained local spec");
  }
  const realRoot = fs.realpathSync(generatedRoot);
  const realFile = fs.realpathSync(file);
  if (!realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error("Generated test path escapes its root");
  return realFile;
}

export function generatedTestFingerprint(file: string): string {
  const config = path.join(path.dirname(file), "playwright.generated.config.cjs");
  return digest(JSON.stringify({
    content: digest(fs.readFileSync(file)),
    config: fs.existsSync(config) ? digest(fs.readFileSync(config)) : "missing",
    runtime: process.version,
    timeout: process.env.PLAYWRIGHT_TIMEOUT ?? "30000",
    playwright: JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "node_modules/@playwright/test/package.json"), "utf8")).version,
  }));
}

const GENERATED_PLAYWRIGHT_CONFIG = `const path = require("path");\nmodule.exports = { testDir: __dirname, timeout: Number(process.env.PLAYWRIGHT_TIMEOUT || 30000), retries: 0, workers: 1, use: { baseURL: process.env.MINISHOP_BASE_URL || "http://localhost:5174", screenshot: "on", trace: "on" }, outputDir: process.env.BTP_ARTIFACT_DIR ? path.resolve(process.env.BTP_ARTIFACT_DIR) : path.join(__dirname, "results"), projects: [{ name: "chromium", use: { browserName: "chromium" } }] };\n`;
export function trustedGeneratedPlaywrightConfig(directory: string): string {
  const configFile = path.join(directory, "playwright.generated.config.cjs");
  const temporary = `${configFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, GENERATED_PLAYWRIGHT_CONFIG, "utf8");
  fs.renameSync(temporary, configFile);
  return configFile;
}

function safeArtifactReference(file: string, artifactDir: string): string {
  const resolved = path.resolve(file); const root = path.resolve(artifactDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Artifact path escaped its root");
  const workspaceRelative = path.relative(WORKSPACE_ROOT, resolved);
  return (!path.isAbsolute(workspaceRelative) && !workspaceRelative.startsWith(`..${path.sep}`) && workspaceRelative !== ".." ? workspaceRelative : path.relative(root, resolved)).replace(/\\/g, "/");
}
