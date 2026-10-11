import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ output: "", code: 0 }));
vi.mock("child_process", () => ({ spawn: () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => { child.stdout.emit("data", Buffer.from(mocks.output)); child.emit("close", mocks.code); });
  return child;
} }));
import { runTest } from "./playwrightRunner";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 })); });
describe("runner evidence classification", () => {
  it("does not accept exit zero without a valid reporter result", async () => {
    mocks.output = "not JSON"; mocks.code = 0;
    const result = await runTest("runner-regression", "tests/playwright/cases/case-001-cart-total.spec.ts", "before");
    expect(result.passed).toBe(false);
    expect((result as any).outcome).toBe("INFRASTRUCTURE_ERROR");
  });
});
