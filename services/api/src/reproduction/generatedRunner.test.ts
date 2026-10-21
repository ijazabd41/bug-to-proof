import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { afterEach, describe, expect, it } from "vitest";
import { runTest } from "../runner/playwrightRunner";
import { persistCompiledReproduction } from "./definitionCompiler";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

describe("generated spec evidence-runner boundary", () => {
  it("accepts a contained compiler-owned spec and records cancellation as infrastructure, never reproduction", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-generated-runner-")); dirs.push(root);
    const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
    const compiled = persistCompiledReproduction({
      schemaVersion: "1.0", title: "Route", startPath: "/", preconditions: [], steps: [],
      assertion: { type: "urlPathEquals", expected: "/" }, rationale: "Route should be root",
      reportMapping: [{ reportFact: "root route", definitionPath: "assertion.expected" }],
    }, "run-cancelled", generatedRoot);
    const controller = new AbortController(); controller.abort();
    const result = await runTest("case-generated", compiled.filePath, "before", {
      generatedTestRoot: generatedRoot, artifactDir, runId: "run-cancelled", abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("INFRASTRUCTURE_ERROR"); expect(result.actual).toMatch(/aborted/i);
    expect(fs.existsSync(path.join(artifactDir, "manifest.json"))).toBe(true);
    expect(result.outcome).not.toBe("ASSERTION_FAILED");
  });

  it("rejects a generated spec outside its explicit root", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "btp-generated-runner-")); dirs.push(root);
    const outside = path.join(root, "outside.spec.ts"); fs.writeFileSync(outside, "test('x', () => {})");
    await expect(runTest("case-generated", outside, "before", { generatedTestRoot: path.join(root, "generated") })).rejects.toThrow(/contained/i);
  });

  it("starts the real Playwright CLI and classifies a compiled structured assertion when Chromium is available", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar4-generation-execution/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-generated-real-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>fixture</title>"); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Wrong route", startPath: "/", preconditions: [], steps: [],
        assertion: { type: "urlPathEquals", expected: "/expected" }, rationale: "Controlled integration assertion",
        reportMapping: [{ reportFact: "wrong route", definitionPath: "assertion.expected" }] }, "real-browser", generatedRoot);
      const result = await runTest("case-generated", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "real-browser", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else if (result.outcome !== "ASSERTION_FAILED") throw new Error(`Unexpected generated runner result: ${JSON.stringify(result)}`);
      expect(fs.existsSync(path.join(artifactDir, "manifest.json"))).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);

  it("executes a discovery-bound test-id action and structured target assertion in the real evidence runner", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar4-generation-execution/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-target-real-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><button data-testid="remove-from-cart-1" onclick="document.querySelector('[data-testid=cart-item-quantity-1]').textContent='×1'">Remove</button><span data-testid="cart-item-quantity-1">×2</span>`); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Quantity decrements", startPath: "/", preconditions: [],
        steps: [{ type: "clickTarget", testId: "remove-from-cart-1" }], assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-1", expected: 1 },
        rationale: "A single removal leaves one unit", reportMapping: [{ reportFact: "quantity should be 1", definitionPath: "assertion.expected" }] }, "real-target", generatedRoot);
      const result = await runTest("case-generated-target", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "real-target", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else expect(result.outcome).toBe("PASSED");
      expect(fs.existsSync(path.join(artifactDir, "manifest.json"))).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);

  it("records a disappeared discovered target as structured assertion evidence", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar4-generation-execution/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-target-missing-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><button data-testid="remove-from-cart-1" onclick="document.querySelector('[data-testid=cart-item-quantity-1]').remove()">Remove</button><span data-testid="cart-item-quantity-1">×2</span>`); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Quantity remains", startPath: "/", preconditions: [],
        steps: [{ type: "clickTarget", testId: "remove-from-cart-1" }], assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-1", expected: 1 },
        rationale: "The expected quantity target must remain", reportMapping: [{ reportFact: "quantity should remain 1", definitionPath: "assertion.expected" }] }, "missing-target", generatedRoot);
      const result = await runTest("case-missing-target", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "missing-target", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else {
        expect(result.outcome).toBe("ASSERTION_FAILED");
        expect(result.actual).toContain("<missing>");
      }
      expect(fs.existsSync(path.join(artifactDir, "manifest.json"))).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);

  it("fills a discovery-bound textbox target in the real evidence runner", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar7-evaluation/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-fill-target-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><input data-testid="promo-input" placeholder="Promo code" oninput="document.querySelector('[data-testid=promo-status]').textContent=this.value"><span data-testid="promo-status"></span>`); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Promo input", startPath: "/", preconditions: [],
        steps: [{ type: "fillTarget", testId: "promo-input", text: "SAVE20" }], assertion: { type: "targetTextEquals", testId: "promo-status", expected: "SAVE20" },
        rationale: "The discovered textbox accepts the report value", reportMapping: [{ reportFact: "enter SAVE20", definitionPath: "steps.0.text" }] }, "real-fill-target", generatedRoot);
      const result = await runTest("case-fill-target", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "real-fill-target", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else expect(result.outcome).toBe("PASSED");
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);

  it("keeps a trusted seedCart setup in memory through its assertion", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar4-generation-execution/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-seed-in-memory-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><button data-testid="add-to-cart-1" onclick="document.querySelector('[data-testid=cart-item-quantity-1]').textContent='×'+(++window.quantity)">Add</button><span data-testid="cart-item-quantity-1">×0</span><script>window.quantity=0</script>`); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Seed quantity", startPath: "/", preconditions: [{ type: "seedCart", productId: 1, quantity: 2 }],
        steps: [], assertion: { type: "targetNumberEquals", testId: "cart-item-quantity-1", expected: 2 },
        rationale: "Seeded quantity remains available", reportMapping: [{ reportFact: "quantity should be 2", definitionPath: "assertion.expected" }] }, "seed-in-memory", generatedRoot);
      const result = await runTest("case-seed-in-memory", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "seed-in-memory", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else expect(result.outcome).toBe("PASSED");
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);

  it("waits briefly for an asynchronous reported result before deciding the assertion", async () => {
    const integrationRoot = path.resolve("artifacts/arbitrary-reproduction/ar4-generation-execution/integration-temp"); fs.mkdirSync(integrationRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(integrationRoot, "btp-async-assertion-")); dirs.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><button data-testid="apply-promo-button" onclick="setTimeout(() => document.querySelector('[data-testid=promo-status]').textContent='Applied', 400)">Apply</button><span data-testid="promo-status">Pending</span>`); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      const generatedRoot = path.join(root, "generated"); const artifactDir = path.join(root, "evidence");
      const compiled = persistCompiledReproduction({ schemaVersion: "1.0", title: "Promo applied", startPath: "/", preconditions: [],
        steps: [{ type: "clickTarget", testId: "apply-promo-button" }], assertion: { type: "targetTextEquals", testId: "promo-status", expected: "Applied" },
        rationale: "Wait for the reported async status", reportMapping: [{ reportFact: "status should be Applied", definitionPath: "assertion.expected" }] }, "async-assertion", generatedRoot);
      const result = await runTest("case-async-assertion", compiled.filePath, "before", { generatedTestRoot: generatedRoot, artifactDir,
        runId: "async-assertion", targetUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 30_000 });
      if (result.failureKind === "BROWSER_UNAVAILABLE") expect(result.outcome).toBe("INFRASTRUCTURE_ERROR");
      else expect(result.outcome).toBe("PASSED");
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 45_000);
});
