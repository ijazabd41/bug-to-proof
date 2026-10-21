import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { aggregateCases, assertHeldoutFresh, canonical, datasetHash, scoreCase, validateDataset, type EvaluationDataset, type ScoredCase } from "./arbitrary-evaluation-core";

const root = path.resolve(import.meta.dirname, "..");
const evalRoot = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-evaluation");
const allowedDatasetRoot = path.join(root, "data", "evals");
const api = process.env.BTP_API_URL ?? "http://127.0.0.1:3001/api";
const args = process.argv.slice(2);
const value = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
if (!args.includes("--confirm-live")) throw new Error("Live provider evaluation requires --confirm-live");
const datasetArg = value("--dataset");
const outputArg = value("--output");
if (!datasetArg || !outputArg) throw new Error("Usage: npm run arbitrary:evaluate:live -- --confirm-live --dataset data/evals/<new-frozen>.json --output artifacts/arbitrary-reproduction/prospective-evaluation/<run-id> [--resume]");
const datasetPath = path.resolve(root, datasetArg);
const outputRoot = path.resolve(root, outputArg);
if (!datasetPath.startsWith(`${allowedDatasetRoot}${path.sep}`) || !datasetPath.endsWith(".json")) throw new Error("Dataset must be a JSON file under data/evals");
if (!outputRoot.startsWith(`${evalRoot}${path.sep}`)) throw new Error("Output must be under artifacts/arbitrary-reproduction/prospective-evaluation");
if (path.basename(datasetPath) === "arbitrary-reproduction-release.json") throw new Error("The AR7 held-out cohort has been consumed; use a newly frozen dataset");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8").replace(/^\uFEFF/, "")) as EvaluationDataset;
validateDataset(dataset);
assertHeldoutFresh(dataset.datasetHash, args.includes("--dev") ? "dev" : "held-out", JSON.parse(fs.readFileSync(path.join(root, "data", "evals", "consumed-heldout.json"), "utf8")));
const selected = dataset.cases.filter(item => item.split === (args.includes("--dev") ? "dev" : "held-out"));
if (!selected.length) throw new Error("Selected split is empty");

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeNew = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status} for ${new URL(url).pathname}`);
  return response.json();
}
async function preflight() {
  const status = await request(`${api}/ai/status`);
  if (status.generationProvider === "disabled" || !status.generationModel) throw new Error("Generation provider/model is not configured on the API");
  const readiness = await request(`${api}/reproduction-preflight`);
  if (!readiness.ready) throw new Error(`Reproduction preflight failed: ${readiness.provider?.code ?? readiness.code ?? "UNKNOWN"}; targetReachable=${!!readiness.targetReachable}; browserAvailable=${!!readiness.browserAvailable}`);
  return { generationProvider: status.generationProvider, generationModel: status.generationModel,
    corpusFingerprint: status.corpusFingerprint, sourceFingerprint: readiness.sourceFingerprint, providerPreflight: readiness.provider.code };
}
const terminal = new Set(["AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED"]);
async function executeCase(item: (typeof selected)[number]): Promise<{ run?: any; caseRecord?: any; error?: string }> {
  let caseRecord: any;
  let run: any;
  try {
    caseRecord = await request(`${api}/cases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.report) });
    const started = await request(`${api}/cases/${caseRecord.id}/reproduction-runs`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await sleep(2_000);
      run = await request(`${api}/reproduction-runs/${started.reproductionRunId}`);
      if (terminal.has(run.state)) return { run, caseRecord };
    }
    return { run, caseRecord, error: "Poll deadline exceeded" };
  } catch (error) {
    return { run, caseRecord, error: error instanceof Error ? error.message : "Unknown evaluation error" };
  }
}

async function main() {
  const status = await preflight();
  const configFingerprint = createHash("sha256").update(canonical({ api, status, split: args.includes("--dev") ? "dev" : "held-out", datasetHash: datasetHash(dataset) })).digest("hex");
  const manifest = { schemaVersion: "2.0", createdAt: new Date().toISOString(), datasetPath: path.relative(root, datasetPath).replace(/\\/g, "/"),
    datasetHash: dataset.datasetHash, frozenAt: dataset.frozenAt, split: args.includes("--dev") ? "dev" : "held-out", caseIds: selected.map(item => item.id),
    api, provider: status.generationProvider, model: status.generationModel, corpusFingerprint: status.corpusFingerprint,
    sourceFingerprint: status.sourceFingerprint, providerPreflight: status.providerPreflight, configFingerprint };
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (fs.existsSync(outputRoot)) {
    if (!args.includes("--resume")) throw new Error("Output already exists; choose a new run ID or pass --resume");
    const prior = readJson(manifestPath);
    if (prior.datasetHash !== manifest.datasetHash || prior.configFingerprint !== configFingerprint || canonical(prior.caseIds) !== canonical(manifest.caseIds)) throw new Error("Resume refused: dataset or API configuration changed");
  } else {
    fs.mkdirSync(outputRoot, { recursive: true });
    writeNew(manifestPath, manifest);
  }
  const results: ScoredCase[] = [];
  for (const item of selected) {
    const itemDir = path.join(outputRoot, item.id);
    const resultPath = path.join(itemDir, "result.json");
    if (fs.existsSync(resultPath)) { results.push(readJson(resultPath)); continue; }
    if (fs.existsSync(itemDir)) throw new Error(`Incomplete case directory ${item.id}; inspect it before resuming to avoid duplicate provider calls`);
    fs.mkdirSync(itemDir);
    const { run, caseRecord, error } = await executeCase(item);
    if (caseRecord) writeNew(path.join(itemDir, "case.json"), caseRecord);
    if (run) writeNew(path.join(itemDir, "run.json"), run);
    const result = scoreCase(item, run, undefined, error);
    writeNew(resultPath, result);
    results.push(result);
    console.log(`${item.id}: ${result.state}${error ? ` (${error})` : ""}`);
  }
  const report = { schemaVersion: "2.0", generatedAt: new Date().toISOString(), manifestHash: createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex"),
    datasetHash: dataset.datasetHash, ...aggregateCases(results), results };
  const aggregatePath = path.join(outputRoot, "aggregate.json");
  if (fs.existsSync(aggregatePath)) throw new Error("Aggregate already exists; immutable run is complete");
  writeNew(aggregatePath, report);
  console.log(JSON.stringify({ outputRoot, denominator: report.denominator, metrics: report.metrics }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
