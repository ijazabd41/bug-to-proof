import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRunWorkspace, releaseWorkspaceLock, startIsolatedMiniShop, stopIsolatedMiniShop, computeSourceManifest } from "../services/api/src/ai/repair/workspace";
import { runTest } from "../services/api/src/runner/playwrightRunner";
import { validateDataset, type EvaluationDataset } from "./arbitrary-evaluation-core";

const root = path.resolve(import.meta.dirname, "..");
const relativeInput = process.argv[2];
if (!relativeInput) throw new Error("Provide a prospective evaluation directory");
const input = path.resolve(root, relativeInput);
const allowedRoot = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-evaluation");
if (!input.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Evaluation directory is outside prospective artifacts");
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const manifest = readJson(path.join(input, "manifest.json"));
const dataset = readJson(path.resolve(root, manifest.datasetPath)) as EvaluationDataset;
validateDataset(dataset);
if (dataset.datasetHash !== manifest.datasetHash) throw new Error("Dataset hash changed");
const selected = dataset.cases.filter(item => item.split === manifest.split);
if (selected.length !== manifest.caseIds.length || selected.some((item, i) => item.id !== manifest.caseIds[i])) throw new Error("Case IDs changed");
const sourceHash = computeSourceManifest(path.join(root, "apps", "minishop")).fingerprint;
if (sourceHash !== dataset.policy.primaryFingerprint) throw new Error("Fixed MiniShop source changed");

async function main() {
for (const item of selected) {
  const caseDir = path.join(input, item.id);
  const runPath = path.join(caseDir, "run.json");
  if (!fs.existsSync(runPath)) continue;
  const run = readJson(runPath);
  const attempt = run.attempts?.find((entry: { classification?: string }) => entry.classification === "ASSERTION_FAILED");
  if (!attempt) continue;
  const reviewDir = path.join(caseDir, "fixed-source-check");
  const reviewPath = path.join(reviewDir, "result.json");
  if (fs.existsSync(reviewPath)) continue;
  fs.mkdirSync(reviewDir, { recursive: true });
  const generatedRoot = path.join(caseDir, "generated");
  const testFile = path.join(generatedRoot, attempt.artifactPaths.find((entry: string) => entry.endsWith("reproduction.spec.ts")));
  const workspace = createRunWorkspace(`review-${item.id}-${randomUUID().slice(0, 8)}`);
  let app: Awaited<ReturnType<typeof startIsolatedMiniShop>> | undefined;
  try {
    app = await startIsolatedMiniShop(workspace);
    const result = await runTest(item.id, testFile, "after", { targetUrl: app.url, runId: `fixed-${item.id}`,
      timeoutMs: 45_000, generatedTestRoot: generatedRoot, artifactDir: path.join(reviewDir, "evidence") });
    fs.writeFileSync(reviewPath, JSON.stringify({ evaluationId: item.id, definitionHash: attempt.definitionHash,
      fixedSourceFingerprint: sourceHash, outcome: result.outcome, failureKind: result.failureKind ?? null,
      actual: result.actual, testFingerprint: result.testFingerprint, artifactPaths: result.artifactPaths }, null, 2) + "\n", { flag: "wx" });
    console.log(`${item.id}: ${result.outcome}${result.failureKind ? ` (${result.failureKind})` : ""}`);
  } finally {
    if (app) await stopIsolatedMiniShop(workspace);
    releaseWorkspaceLock(workspace);
    if (computeSourceManifest(path.join(root, "apps", "minishop")).fingerprint !== sourceHash) throw new Error("Primary MiniShop source changed during review");
  }
}
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
