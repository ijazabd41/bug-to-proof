import { EventEmitter } from "events";
import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ output: "", code: 0 }));
vi.mock("child_process", () => ({ spawn: () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => { child.stdout.emit("data", Buffer.from(mocks.output)); child.emit("close", mocks.code); });
  return child;
} }));
import { generatedTestFingerprint, runTest, trustedGeneratedPlaywrightConfig } from "./playwrightRunner";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 })); });
describe("runner evidence classification", () => {
  it("does not accept exit zero without a valid reporter result", async () => {
    mocks.output = "not JSON"; mocks.code = 0;
    const result = await runTest("runner-regression", "tests/playwright/cases/case-001-cart-total.spec.ts", "before");
    expect(result.passed).toBe(false);
    expect((result as any).outcome).toBe("INFRASTRUCTURE_ERROR");
  });
});

describe("generated configuration integrity", () => {
  it("includes trusted config bytes in the generated fingerprint and overwrites stale config", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-config-"));
    try {
      const file = path.join(root, "x.spec.ts"); fs.writeFileSync(file, "export {};");
      fs.writeFileSync(path.join(root, "playwright.generated.config.cjs"), "tampered");
      const first = generatedTestFingerprint(file);
      trustedGeneratedPlaywrightConfig(root);
      expect(fs.readFileSync(path.join(root, "playwright.generated.config.cjs"), "utf8")).not.toBe("tampered");
      expect(generatedTestFingerprint(file)).not.toBe(first);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
