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
import { classifyReport } from "./classification";
export { classifyReport } from "./classification";
export interface RunTestOptions {
  targetUrl?: string;
  artifactDir?: string;
  timeoutMs?: number;
  runId?: string;
  abortSignal?: AbortSignal;
}

export async function runTest(
  caseId: string,
  testFile: string,
  phase: "before" | "after",
  options?: RunTestOptions
): Promise<RunResult> {
  if (!/^[a-zA-Z0-9-]{1,50}$/.test(caseId)) throw new Error("Invalid case ID");
  const file = resolveTest(testFile);
  const fingerprint = testFingerprint(testFile);
  const runId = options?.runId ?? randomUUID();
  const targetUrl = options?.targetUrl ?? process.env.MINISHOP_BASE_URL ?? "http://localhost:5174";
  const artifactDir = options?.artifactDir ?? path.join(ARTIFACTS_DIR, caseId, phase, runId);
  fs.mkdirSync(artifactDir, { recursive: true });
  const start = Date.now();
  const base: RunResult = { passed: false, outcome: "INFRASTRUCTURE_ERROR", expected: "", actual: "", durationMs: 0,
    runId, testFingerprint: fingerprint, testIds: [], artifactPaths: {}, rawOutput: "" };
  function record(result: RunResult, report?: any): RunResult {
    try {
      if (testFingerprint(testFile) !== fingerprint) throw new Error("changed");
    } catch {
      result.outcome = "INFRASTRUCTURE_ERROR"; result.passed = false; result.actual = "Test inputs changed during execution";
    }
    fs.writeFileSync(path.join(artifactDir, "output.log"), result.rawOutput);
    if (report) {
      const json = JSON.stringify(report, null, 2);
      fs.writeFileSync(path.join(artifactDir, "result.json"), json);
      result.reportHash = digest(json);
      result.artifactPaths.resultJson = path.relative(WORKSPACE_ROOT, path.join(artifactDir, "result.json")).replace(/\\/g, "/");
      const attachments = (suite: any): any[] => [
        ...(suite.specs ?? []).flatMap((s: any) => (s.tests ?? []).flatMap((t: any) => (t.results ?? []).flatMap((r: any) => r.attachments ?? []))),
        ...(suite.suites ?? []).flatMap(attachments),
      ];
      for (const attachment of (report.suites ?? []).flatMap(attachments)) {
        if (!attachment.path) continue;
        const target = path.resolve(attachment.path);
        if (!target.startsWith(artifactDir + path.sep) || !fs.existsSync(target)) continue;
        const key = attachment.name === "trace" ? "trace" : attachment.contentType === "image/png" ? "screenshot" : null;
        if (key && !result.artifactPaths[key]) result.artifactPaths[key] = path.relative(WORKSPACE_ROOT, target).replace(/\\/g, "/");
      }
    }
    fs.writeFileSync(path.join(artifactDir, "manifest.json"), JSON.stringify(result, null, 2));
    return result;
  }
  if (options?.abortSignal?.aborted) {
    return record({ ...base, actual: "Execution aborted before starting", durationMs: Date.now() - start });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(targetUrl, { method: "GET", signal: controller.signal });
    if (!response.ok) throw new Error(`MiniShop HTTP ${response.status}`);
  } catch (error) {
    return record({ ...base, actual: `MiniShop is not reachable at ${targetUrl}`, rawOutput: String(error), durationMs: Date.now() - start });
  } finally { clearTimeout(timer); }
  return new Promise((resolve) => {
    let stdout = "", stderr = "", settled = false; let watchdog: ReturnType<typeof setTimeout>;
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config",
      "tests/playwright/playwright.config.ts", path.relative(WORKSPACE_ROOT, file).replace(/\\/g, "/"),
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
          finish({ ...base, actual: "Evidence runner was cancelled by abort signal", rawOutput: stdout + "\n" + stderr, durationMs: Date.now() - start });
        }
      };
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }
    watchdog = setTimeout(async () => {
      await terminateProcessTree(child);
      finish({ ...base, actual: `Evidence runner exceeded its ${Math.round(timeoutMs / 1000)}-second limit`, rawOutput: stdout + "\n" + stderr, durationMs: Date.now() - start });
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
      } catch { finish({ ...result, actual: "Invalid or missing Playwright JSON report" }); }
    });
  });
}
