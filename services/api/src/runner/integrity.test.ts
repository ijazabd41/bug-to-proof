import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import seed from "../routes/legacy-case.fixture.json";
import type { BugCase } from "@bug-to-proof/shared-types";
import { ARTIFACTS_DIR } from "../utils/paths";
import { digest, testFingerprint, validBaseline } from "./integrity";
describe("baseline integrity (synthetic manifest fixtures)", () => {
  it("rejects absent, altered, or mismatched evidence", () => {
    const bugCase = structuredClone(seed) as BugCase;
    const runId = randomUUID();
    const dir = path.join(ARTIFACTS_DIR, "case-001", "before", runId);
    fs.mkdirSync(dir, { recursive: true });
    const report = JSON.stringify({
      stats: { expected: 0, unexpected: 1 },
      suites: [{ specs: [{ file: "cart.spec.ts", title: "cart", tests: [{
        projectName: "chromium", expectedStatus: "passed",
        results: [{ status: "failed", error: { message: "BTP_ASSERTION: total Expected: $30 Received: $10" },
          attachments: [{ name: "btp-assertion", contentType: "application/json",
            body: Buffer.from(JSON.stringify({ actual: "$10", expected: "$30" })).toString("base64") }] }],
      }] }] }],
    });
    const run = { ...bugCase.verification!.beforeRun!, outcome: "ASSERTION_FAILED" as const,
      testFingerprint: testFingerprint(bugCase.reproduction!.testFile),
      runId, reportHash: digest(report), testIds: ["cart.spec.ts:cart:chromium"], exitCode: 1 };
    bugCase.verification!.beforeRun = run;
    try {
      expect(validBaseline(bugCase)).toBe(false);
      fs.writeFileSync(path.join(dir, "result.json"), report);
      fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(run));
      expect(validBaseline(bugCase)).toBe(true);
      fs.writeFileSync(path.join(dir, "result.json"), "altered");
      expect(validBaseline(bugCase)).toBe(false);
      fs.writeFileSync(path.join(dir, "result.json"), report);
      run.testFingerprint = "different";
      expect(validBaseline(bugCase)).toBe(false);
    } finally {
      for (const file of ["result.json", "manifest.json"]) {
        const target = path.join(dir, file);
        if (fs.existsSync(target)) fs.unlinkSync(target);
      }
      fs.rmdirSync(dir);
    }
  });
  it("hashes helper/config/shared inputs as well as the selected spec", () => {
    const original = fs.readFileSync;
    const fingerprint = testFingerprint(seed.reproduction.testFile);
    const spy = vi.spyOn(fs, "readFileSync").mockImplementation(((file: any, ...args: any[]) => {
      const data = (original as any)(file, ...args);
      return String(file).endsWith("minishop.ts") ? Buffer.from(String(data) + "\n// edited helper") : data;
    }) as any);
    try { expect(testFingerprint(seed.reproduction.testFile)).not.toBe(fingerprint); }
    finally { spy.mockRestore(); }
  });
});


