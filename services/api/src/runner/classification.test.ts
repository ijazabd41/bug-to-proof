import { describe, expect, it } from "vitest";
import { classifyReport } from "./playwrightRunner";
function report(status: string, error?: string, evidence = true) {
  return {
    stats: { expected: status === "passed" ? 1 : 0, unexpected: status === "failed" ? 1 : 0 },
    suites: [{ suites: [{ specs: [{ file: "cart.spec.ts", title: "cart", tests: [{
      projectName: "chromium", expectedStatus: "passed", results: [{
        status, error: error ? { message: error } : undefined,
        attachments: evidence ? [{ name: "btp-assertion", contentType: "application/json",
          body: Buffer.from(JSON.stringify({ expected: "$30.00", actual: "$10.00" })).toString("base64") }] : [],
      }],
    }] }] }] }],
  };
}
describe("report classification (simulated reports)", () => {
  it("accepts a complete pass and nested suites", () => {
    expect(classifyReport(report("passed"), 0).outcome).toBe("PASSED");
  });
  it("recognizes only an instrumented behavior assertion", () => {
    expect(classifyReport(report("failed", "BTP_ASSERTION: total\nExpected: $30.00\nReceived: $10.00"), 1).outcome).toBe("ASSERTION_FAILED");
  });
  it.each(["timedOut", "skipped", "interrupted"])("rejects %s", (status) => {
    expect(classifyReport(report(status), 1).outcome).toBe("INFRASTRUCTURE_ERROR");
  });
  it.each(["browserType.launch: executable missing", "net::ERR_CONNECTION_REFUSED", "locator.click: Timeout", "BTP_ASSERTION: Expected: x Received: y"])(
    "rejects unbacked or infrastructure errors: %s", (error) => {
      expect(classifyReport(report("failed", error, false), 1).outcome).toBe("INFRASTRUCTURE_ERROR");
    },
  );
  it("rejects no tests, global errors, and contradictory exit status", () => {
    expect(classifyReport({ suites: [], stats: { expected: 0 } }, 0).outcome).toBe("INFRASTRUCTURE_ERROR");
    expect(classifyReport({ ...report("passed"), errors: [{ message: "config error" }] }, 0).outcome).toBe("INFRASTRUCTURE_ERROR");
    expect(classifyReport(report("passed"), 1).outcome).toBe("INFRASTRUCTURE_ERROR");
  });
  it.each([
    ["browserType.launch: executable missing", "BROWSER_UNAVAILABLE"],
    ["page.goto: net::ERR_CONNECTION_REFUSED", "TARGET_UNREACHABLE"],
    ["locator.click: Timeout 30000ms exceeded", "SELECTOR_OR_ACTION_ERROR"],
  ])("returns structured failure kind for %s", (error, failureKind) => {
    expect(classifyReport(report("failed", error, false), 1)).toMatchObject({ outcome: "INFRASTRUCTURE_ERROR", failureKind });
  });
});
