import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prospectiveV2Fixtures, type ProspectiveFixture } from "../data/evals/prospective-v2-fixtures";
import { createRunWorkspace, releaseWorkspaceLock, startIsolatedMiniShop, stopIsolatedMiniShop, computeSourceManifest } from "../services/api/src/ai/repair/workspace";
import { runTest, testFingerprint } from "../services/api/src/runner/playwrightRunner";
import { datasetHash, type EvaluationDataset } from "./arbitrary-evaluation-core";

const root = path.resolve(import.meta.dirname, "..");
const evidenceRoot = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-reference");
const datasetPath = path.join(root, "data", "evals", "arbitrary-reproduction-v2.json");
const caseArg = process.argv.includes("--case") ? process.argv[process.argv.indexOf("--case") + 1] : undefined;
const verifyOnly = process.argv.includes("--verify-only");
if (!caseArg && fs.existsSync(datasetPath) && !verifyOnly) throw new Error("Frozen v2 dataset already exists; use --verify-only to check references without rewriting the dataset");
const fixtures = caseArg ? prospectiveV2Fixtures.filter(item => item.id === caseArg) : prospectiveV2Fixtures;
if (!fixtures.length) throw new Error(`Unknown reference case: ${caseArg}`);
const runRoot = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(runRoot, { recursive: true });
const primaryRoot = path.join(root, "apps", "minishop");
const primaryFingerprint = computeSourceManifest(primaryRoot).fingerprint;
const normalize = (value: string) => value.replace(/\r\n/g, "\n");

async function verify(item: ProspectiveFixture) {
  const runId = `reference-${item.id}-${randomUUID().slice(0, 8)}`;
  const ws = createRunWorkspace(runId);
  let app: Awaited<ReturnType<typeof startIsolatedMiniShop>> | undefined;
  const caseDir = path.join(runRoot, item.id);
  fs.mkdirSync(caseDir);
  const referenceTestHash = testFingerprint(item.referenceTest);
  try {
    for (const defect of item.defects) {
      const file = path.join(ws.minishopDir, defect.relativePath);
      const source = normalize(fs.readFileSync(file, "utf8"));
      const fixed = normalize(defect.fixedContent);
      if (source.split(fixed).length !== 2) throw new Error(`Expected one fixed snippet in ${defect.relativePath}`);
      fs.writeFileSync(file, source.replace(fixed, normalize(defect.buggyContent)), "utf8");
    }
    const variantFingerprint = computeSourceManifest(ws.minishopDir).fingerprint;
    app = await startIsolatedMiniShop(ws);
    const baseline = await runTest(item.id, item.referenceTest, "before", { targetUrl: app.url, runId: `${runId}-before`, artifactDir: path.join(caseDir, "baseline") });
    const expectedBaseline = item.label === "control" ? "PASSED" : "ASSERTION_FAILED";
    if (baseline.outcome !== expectedBaseline) throw new Error(`Reference baseline ${baseline.outcome}; expected ${expectedBaseline} (${baseline.failureKind ?? "none"})`);
    let postPatch: Awaited<ReturnType<typeof runTest>> | undefined;
    if (item.defects.length) {
      for (const defect of item.defects) {
        const file = path.join(ws.minishopDir, defect.relativePath);
        const source = normalize(fs.readFileSync(file, "utf8"));
        const buggy = normalize(defect.buggyContent);
        if (source.split(buggy).length !== 2) throw new Error(`Expected one buggy snippet in ${defect.relativePath}`);
        fs.writeFileSync(file, source.replace(buggy, normalize(defect.fixedContent)), "utf8");
      }
      postPatch = await runTest(item.id, item.referenceTest, "after", { targetUrl: app.url, runId: `${runId}-after`, artifactDir: path.join(caseDir, "post-patch") });
      if (postPatch.outcome !== "PASSED" || postPatch.testFingerprint !== baseline.testFingerprint) throw new Error(`Reference post-patch ${postPatch.outcome}; expected same-test PASSED`);
    }
    return { id: item.id, label: item.label, status: "VERIFIED", variantFingerprint, referenceTestHash,
      baselineOutcome: baseline.outcome, postPatchOutcome: postPatch?.outcome ?? null,
      baselineEvidence: path.relative(root, path.join(caseDir, "baseline")).replace(/\\/g, "/"),
      postPatchEvidence: postPatch ? path.relative(root, path.join(caseDir, "post-patch")).replace(/\\/g, "/") : null };
  } catch (error) {
    return { id: item.id, label: item.label, status: "FAILED", error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (app) await stopIsolatedMiniShop(ws);
    releaseWorkspaceLock(ws);
  }
}

async function main() {
  const results: Array<Awaited<ReturnType<typeof verify>>> = [];
  try {
    for (const item of fixtures) {
      const result = await verify(item);
      results.push(result);
      fs.writeFileSync(path.join(runRoot, `${item.id}.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
      console.log(`${item.id}: ${result.status}`);
    }
  } finally {
    const finalFingerprint = computeSourceManifest(primaryRoot).fingerprint;
    if (finalFingerprint !== primaryFingerprint) throw new Error("Primary MiniShop source changed during reference verification");
  }
  const complete = results.length === prospectiveV2Fixtures.length && results.every(item => item.status === "VERIFIED");
  const report = { schemaVersion: "1.0", generatedAt: new Date().toISOString(), primaryFingerprint, complete, results };
  fs.writeFileSync(path.join(runRoot, "aggregate.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  if (!complete) { if (!caseArg || results.some(item => item.status !== "VERIFIED")) process.exitCode = 1; return; }
  if (verifyOnly) {
    const frozen = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as EvaluationDataset;
    if (frozen.policy.primaryFingerprint !== primaryFingerprint || frozen.cases.some(item => {
      const result = results.find(row => row.id === item.id);
      return result?.status !== "VERIFIED" || result.variantFingerprint !== item.variantFingerprint || result.referenceTestHash !== item.referenceTestHash;
    })) throw new Error("Reference recheck differs from the frozen dataset");
    console.log(JSON.stringify({ verifiedAgainstFrozenDataset: datasetPath, datasetHash: frozen.datasetHash, referenceEvidence: runRoot }, null, 2));
    return;
  }
  if (fs.existsSync(datasetPath)) throw new Error("Frozen v2 dataset already exists; refusing to overwrite it");
  const frozenAt = new Date().toISOString();
  const dataset: EvaluationDataset = { schemaVersion: "2.0", frozenAt, status: "FROZEN_FOR_FUTURE_EVALUATION",
    policy: { promptTuningAfterFreezeAllowed: false, referenceTestsVisibleToGeneration: false, referenceFixesVisibleToGeneration: false,
      primaryFingerprint, referenceEvidence: path.relative(root, runRoot).replace(/\\/g, "/"),
      scoring: "Independent reviewed report match is required; unreviewed assertion failures are separate." },
    cases: prospectiveV2Fixtures.map(item => ({ id: item.id, split: item.split ?? "held-out", category: item.category, report: item.report,
      label: item.label, defects: item.defects, referenceTest: item.referenceTest,
      variantFingerprint: (results.find(result => result.id === item.id) as { variantFingerprint?: string })?.variantFingerprint,
      referenceTestHash: (results.find(result => result.id === item.id) as { referenceTestHash?: string })?.referenceTestHash })),
    datasetHash: "" };
  dataset.datasetHash = datasetHash(dataset);
  fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ datasetPath, datasetHash: dataset.datasetHash, referenceEvidence: runRoot }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
