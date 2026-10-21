import fs from "node:fs";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { GenerationProviderError } from "./generationProvider";
import { ReproductionRunStore } from "./reproductionRunStore";
import { ReproductionService } from "./reproductionService";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

it("records a provider outage as a blocked attempt with the number of HTTP requests", async () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), "artifacts", "provider-test-"));
  roots.push(root);
  const store = new ReproductionRunStore(path.join(root, "records"));
  const service = new ReproductionService({
    store,
    generatedRoot: path.join(root, "generated"),
    discover: async () => ({ schemaVersion: "1.0", sourceFingerprint: "source", inventoryDigest: "inventory", routes: ["/"], controls: [], headings: [], fixtures: { products: [] }, sourceFiles: [], capturedAt: new Date().toISOString() }),
    generate: async () => { throw new GenerationProviderError("Provider returned HTTP 429 (http_error:429)", "openai", "fixture", "http_error:429", 3, 429); },
    execute: async () => { throw new Error("Must not execute"); },
  });
  const run = await service.run({ caseId: "provider-outage", targetUrl: "http://localhost:5174", report: { title: "Cart", description: "Total", steps: ["Open cart"], expected: "15", actual: "10" } });
  expect(run.state).toBe("BLOCKED");
  expect(run.attempts).toHaveLength(1);
  expect(run.attempts[0]).toMatchObject({ classification: "PROVIDER_ERROR", provider: "openai", responseShape: "http_error:429", requestAttempts: 3, httpStatus: 429 });
  expect(store.read(run.reproductionRunId)?.attempts).toEqual(run.attempts);
});
