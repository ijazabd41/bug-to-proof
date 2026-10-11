import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import seed from "../routes/legacy-case.fixture.json";
import { rimrafDir } from "../utils/rimraf";

const rootDir = path.resolve(__dirname, "../../../..");
const scratchBase = path.join(rootDir, "artifacts", "scratch");

describe("API Startup Resilience & Interrupted Case Reconciliation under Disk Corruption", () => {
  const testDirs: string[] = [];

  function createTempTestEnv(name: string) {
    const testDir = path.join(scratchBase, `startup-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(path.join(testDir, "cases"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "artifacts"), { recursive: true });
    testDirs.push(testDir);
    return testDir;
  }

  afterEach(() => {
    for (const d of testDirs) {
      rimrafDir(d);
    }
    testDirs.length = 0;
  });

  it("starts cleanly, reports corrupt records, preserves their bytes, and reconciles valid interrupted cases", () => {
    const testDir = createTempTestEnv("corrupt-reproduction");
    const casesDir = path.join(testDir, "cases");

    // 1. Create a corrupt case record
    fs.writeFileSync(path.join(casesDir, "case-corrupt.json"), "{ invalid JSON content", "utf-8");

    // 2. Create a valid interrupted case record
    const interruptedCase = {
      ...seed,
      id: "case-interrupted-reproducing",
      status: "REPRODUCING",
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(casesDir, "case-interrupted-reproducing.json"),
      JSON.stringify(interruptedCase, null, 2),
      "utf-8"
    );

    // 3. Spawn child process to initialize API
    const script = `
      const app = require('./services/api/src/index.ts');
    `;

    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATA_DIR: testDir,
        ARTIFACTS_DIR: path.join(testDir, "artifacts"),
      },
      encoding: "utf8",
      timeout: 60000,
    });

    // In fixed code, this must exit 0, reconcile valid cases, and preserve corrupt files
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("CorruptCaseRecordError");

    // Check that corrupt file remains untouched
    const corruptContent = fs.readFileSync(path.join(casesDir, "case-corrupt.json"), "utf-8");
    expect(corruptContent).toBe("{ invalid JSON content");

    // Check that valid interrupted case was reconciled
    const reconciledRaw = fs.readFileSync(path.join(casesDir, "case-interrupted-reproducing.json"), "utf-8");
    const reconciled = JSON.parse(reconciledRaw);
    expect(reconciled.status).toBe("REPRODUCTION_FAILED");
  }, 60000);

  it("healthy-start control: initializes cleanly and reconciles interrupted cases when no corruption exists", () => {
    const testDir = createTempTestEnv("healthy-control");
    const casesDir = path.join(testDir, "cases");

    const verifyingCase = {
      ...seed,
      id: "case-interrupted-verifying",
      status: "VERIFYING",
      verification: {
        status: "VERIFYING",
        expected: "Exp",
        actual: "Act",
        testFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
        lastRun: null,
      },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(casesDir, "case-interrupted-verifying.json"),
      JSON.stringify(verifyingCase, null, 2),
      "utf-8"
    );

    const normalCase = {
      ...seed,
      id: "case-normal-reported",
      status: "REPORTED",
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(casesDir, "case-normal-reported.json"),
      JSON.stringify(normalCase, null, 2),
      "utf-8"
    );

    const script = `
      const app = require('./services/api/src/index.ts');
    `;

    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATA_DIR: testDir,
        ARTIFACTS_DIR: path.join(testDir, "artifacts"),
      },
      encoding: "utf8",
      timeout: 60000,
    });

    expect(result.status).toBe(0);

    const reconciledRaw = fs.readFileSync(path.join(casesDir, "case-interrupted-verifying.json"), "utf-8");
    const reconciled = JSON.parse(reconciledRaw);
    expect(reconciled.status).toBe("VERIFICATION_FAILED");
    expect(reconciled.verification.status).toBe("VERIFICATION_FAILED");

    const normalRaw = fs.readFileSync(path.join(casesDir, "case-normal-reported.json"), "utf-8");
    const normal = JSON.parse(normalRaw);
    expect(normal.status).toBe("REPORTED");
  }, 60000);
});
