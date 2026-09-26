import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../utils/paths";

export interface RunResult {
  passed: boolean;
  expected: string;
  actual: string;
  durationMs: number;
  artifactPaths: {
    screenshot?: string;
    trace?: string;
    resultJson?: string;
  };
  rawOutput: string;
}

const MINISHOP_URL = "http://localhost:5174";

/** Check if MiniShop is reachable via HTTP HEAD. */
async function isMiniShopRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(MINISHOP_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Run a Playwright test file for a given case + phase.
 * Returns a RunResult describing the outcome.
 */
export async function runTest(
  caseId: string,
  testFile: string,
  phase: "before" | "after"
): Promise<RunResult> {
  // ── Pre-flight: is MiniShop up? ─────────────────────────────────────────
  const shopRunning = await isMiniShopRunning();
  if (!shopRunning) {
    return {
      passed: false,
      expected: "",
      actual: "MiniShop is not running at port 5174",
      durationMs: 0,
      artifactPaths: {},
      rawOutput: "Pre-flight check failed: MiniShop not reachable at http://localhost:5174",
    };
  }

  // ── Prepare artifact output dir ─────────────────────────────────────────
  const artifactDir = path.join(ARTIFACTS_DIR, caseId, phase);
  fs.mkdirSync(artifactDir, { recursive: true });

  const resultJsonPath = path.join(artifactDir, "result.json");

  // ── Spawn Playwright ────────────────────────────────────────────────────
  const start = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(
      "npx",
      ["playwright", "test", testFile, "--reporter=json"],
      {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          PHASE: phase,
          CASE_ID: caseId,
        },
        shell: true,
      }
    );

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      const rawOutput = stdout + (stderr ? `\n[stderr]\n${stderr}` : "");

      // ── Parse JSON reporter output ─────────────────────────────────────
      let passed = code === 0;
      let actual = passed ? "Test passed as expected" : "Test failed";
      let expected = "";

      try {
        // Playwright JSON reporter may output before non-JSON lines
        const jsonStart = stdout.indexOf("{");
        if (jsonStart !== -1) {
          const jsonStr = stdout.slice(jsonStart);
          const report = JSON.parse(jsonStr) as {
            stats?: { expected?: number; unexpected?: number };
            suites?: Array<{
              specs?: Array<{
                tests?: Array<{
                  results?: Array<{
                    status?: string;
                    error?: { message?: string };
                  }>;
                  title?: string;
                }>;
              }>;
            }>;
          };

          // Determine pass from stats
          const stats = report.stats;
          if (stats) {
            passed = (stats.unexpected ?? 0) === 0 && (stats.expected ?? 0) > 0;
          }

          // Extract error message for "actual"
          const firstSpec = report.suites?.[0]?.specs?.[0];
          const firstTest = firstSpec?.tests?.[0];
          const firstResult = firstTest?.results?.[0];
          if (firstResult?.error?.message) {
            actual = firstResult.error.message.split("\n")[0];
          }
          expected = firstTest?.title ?? "";

          // Write result.json
          fs.writeFileSync(resultJsonPath, JSON.stringify(report, null, 2), "utf-8");
        }
      } catch (parseErr) {
        console.warn("[runner] Could not parse Playwright JSON output:", parseErr);
      }

      // ── Resolve artifact paths ─────────────────────────────────────────
      const screenshotPath = path.join(artifactDir, "screenshot.png");
      const tracePath = path.join(artifactDir, "trace.zip");

      const artifactPaths: RunResult["artifactPaths"] = {};
      if (fs.existsSync(screenshotPath)) {
        artifactPaths.screenshot = `artifacts/${caseId}/${phase}/screenshot.png`;
      }
      if (fs.existsSync(tracePath)) {
        artifactPaths.trace = `artifacts/${caseId}/${phase}/trace.zip`;
      }
      if (fs.existsSync(resultJsonPath)) {
        artifactPaths.resultJson = `artifacts/${caseId}/${phase}/result.json`;
      }

      resolve({
        passed,
        expected,
        actual,
        durationMs,
        artifactPaths,
        rawOutput,
      });
    });

    child.on("error", (err) => {
      resolve({
        passed: false,
        expected: "",
        actual: `Runner spawn error: ${err.message}`,
        durationMs: Date.now() - start,
        artifactPaths: {},
        rawOutput: err.message,
      });
    });
  });
}
