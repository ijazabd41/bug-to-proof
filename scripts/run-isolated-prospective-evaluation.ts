import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { chromium } from "playwright";
import { ragConfig } from "../services/api/src/ai/providers";
import { MAX_REQUEST_ATTEMPTS } from "../services/api/src/llm/client";
import { aggregateCases, assertHeldoutFresh, canonical, scoreCase, validateDataset, type EvaluationCase, type EvaluationDataset, type ScoredCase } from "./arbitrary-evaluation-core";
import { createRunWorkspace, releaseWorkspaceLock, startIsolatedMiniShop, stopIsolatedMiniShop, computeSourceManifest } from "../services/api/src/ai/repair/workspace";
import { discoverTargetSurface } from "../services/api/src/reproduction/targetDiscovery";
import { generateReproductionCandidate, preflightReproductionProvider } from "../services/api/src/reproduction/generationProvider";
import { ReproductionRunStore } from "../services/api/src/reproduction/reproductionRunStore";
import { ReproductionService, REPRODUCTION_PROMPT_VERSION } from "../services/api/src/reproduction/reproductionService";
import { COMPILER_VERSION } from "../services/api/src/reproduction/definitionCompiler";
import { DEFAULT_REPRODUCTION_LIMITS, type ReportSnapshot } from "../services/api/src/reproduction/contracts";
import { runTest } from "../services/api/src/runner/playwrightRunner";

interface IsolatedCase extends EvaluationCase {
  label: "answerable-bug" | "control";
  defects: Array<{ relativePath: string; fixedContent: string; buggyContent: string }>;
  variantFingerprint: string;
  referenceTestHash: string;
}
const root = path.resolve(import.meta.dirname, "..");
loadEnv({ path: path.join(root, ".env") });
const args = process.argv.slice(2);
const value = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
if (!args.includes("--confirm-live")) throw new Error("Live generation requires --confirm-live");
const datasetArg = value("--dataset") || "data/evals/arbitrary-reproduction-v2.json";
const outputArg = value("--output");
if (!outputArg) throw new Error("Provide --output artifacts/arbitrary-reproduction/prospective-evaluation/<run-id>");
const datasetPath = path.resolve(root, datasetArg);
const outputRoot = path.resolve(root, outputArg);
const allowedOutputRoot = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-evaluation");
if (!datasetPath.startsWith(`${path.join(root, "data", "evals")}${path.sep}`)) throw new Error("Dataset must be under data/evals");
if (!outputRoot.startsWith(`${allowedOutputRoot}${path.sep}`)) throw new Error("Output must be under prospective-evaluation artifacts");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as EvaluationDataset;
validateDataset(dataset);
assertHeldoutFresh(dataset.datasetHash, args.includes("--dev") ? "dev" : "held-out", JSON.parse(fs.readFileSync(path.join(root, "data", "evals", "consumed-heldout.json"), "utf8")));
const generationConfig = ragConfig();
const runPolicyPath = datasetPath.replace(/\.json$/, "-run-policy.json");
if (fs.existsSync(runPolicyPath)) {
  const policy = JSON.parse(fs.readFileSync(runPolicyPath, "utf8"));
  if (policy.datasetHash !== dataset.datasetHash || policy.provider !== generationConfig.generationProvider ||
    policy.model !== generationConfig.generationModel || policy.endpoint !== generationConfig.generationBaseUrl.replace(/\/$/, "") ||
    policy.providerTimeoutMs !== generationConfig.timeoutMs || policy.promptVersion !== REPRODUCTION_PROMPT_VERSION ||
    policy.compilerVersion !== COMPILER_VERSION || policy.providerHttpRequestAttemptsMax !== MAX_REQUEST_ATTEMPTS ||
    policy.candidateAttemptsMax !== DEFAULT_REPRODUCTION_LIMITS.maxAttempts) {
    throw new Error("Configured generation settings differ from the frozen run policy");
  }
}
const selected = dataset.cases.filter(item => item.split === (args.includes("--dev") ? "dev" : "held-out")) as IsolatedCase[];
if (!selected.length || selected.some(item => !Array.isArray(item.defects) || !item.variantFingerprint || !item.referenceTestHash)) throw new Error("Dataset lacks verified isolated variants");
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeNew = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const normalize = (value: string) => value.replace(/\r\n/g, "\n");

async function runCase(item: IsolatedCase, caseDir: string) {
  const runId = `eval-${item.id}-${randomUUID().slice(0, 8)}`;
  const ws = createRunWorkspace(runId);
  let app: Awaited<ReturnType<typeof startIsolatedMiniShop>> | undefined;
  try {
    for (const defect of item.defects) {
      const file = path.join(ws.minishopDir, defect.relativePath);
      const source = normalize(fs.readFileSync(file, "utf8"));
      const fixed = normalize(defect.fixedContent);
      if (source.split(fixed).length !== 2) throw new Error(`Fixture source changed: ${defect.relativePath}`);
      fs.writeFileSync(file, source.replace(fixed, normalize(defect.buggyContent)), "utf8");
    }
    if (computeSourceManifest(ws.minishopDir).fingerprint !== item.variantFingerprint) throw new Error("Variant fingerprint differs from frozen reference");
    app = await startIsolatedMiniShop(ws);
    const generatedRoot = path.join(caseDir, "generated");
    const store = new ReproductionRunStore(path.join(caseDir, "records"));
    const service = new ReproductionService({ store, generatedRoot,
      discover: async () => discoverTargetSurface(ws.minishopDir), generate: generateReproductionCandidate,
      execute: ({ caseId, testFile, targetUrl, runId: executionId, timeoutMs, abortSignal }) => runTest(caseId, testFile, "before", {
        targetUrl, runId: executionId, timeoutMs, abortSignal, generatedTestRoot: generatedRoot,
        artifactDir: path.join(caseDir, "evidence", executionId),
      }),
      fingerprintSource: () => computeSourceManifest(ws.minishopDir).fingerprint,
    });
    const run = await service.run({ reproductionRunId: runId, caseId: item.id, report: item.report as unknown as ReportSnapshot, targetUrl: app.url });
    return run;
  } finally {
    if (app) await stopIsolatedMiniShop(ws);
    releaseWorkspaceLock(ws);
  }
}

async function main() {
  const primaryFingerprint = computeSourceManifest(path.join(root, "apps", "minishop")).fingerprint;
  if (primaryFingerprint !== dataset.policy.primaryFingerprint) throw new Error("Primary MiniShop source changed since dataset freeze");
  if (!fs.existsSync(chromium.executablePath())) throw new Error("Playwright Chromium is not installed");
  const provider = await preflightReproductionProvider();
  if (!provider.ready) throw new Error(`Generation provider preflight failed: ${provider.code}`);
  if (provider.provider !== "ollama" && !args.includes("--confirm-external-source")) throw new Error("Hosted generation sends report and MiniShop target metadata externally; --confirm-external-source is required");
  const configuration = { datasetHash: dataset.datasetHash, primaryFingerprint, provider: provider.provider, model: provider.model,
    endpoint: generationConfig.generationBaseUrl.replace(/\/$/, ""), providerTimeoutMs: generationConfig.timeoutMs,
    providerHttpRequestAttemptsMax: MAX_REQUEST_ATTEMPTS,
    providerPreflight: provider.code, promptVersion: REPRODUCTION_PROMPT_VERSION, compilerVersion: COMPILER_VERSION, limits: DEFAULT_REPRODUCTION_LIMITS,
    split: args.includes("--dev") ? "dev" : "held-out" };
  const configFingerprint = createHash("sha256").update(canonical(configuration)).digest("hex");
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (fs.existsSync(outputRoot)) {
    if (!args.includes("--resume")) throw new Error("Output already exists; choose a new run ID or pass --resume");
    const prior = readJson(manifestPath);
    if (prior.configFingerprint !== configFingerprint || canonical(prior.caseIds) !== canonical(selected.map(item => item.id))) throw new Error("Resume refused: frozen inputs changed");
  } else {
    fs.mkdirSync(outputRoot, { recursive: true });
    writeNew(manifestPath, { schemaVersion: "2.0", createdAt: new Date().toISOString(), datasetPath: path.relative(root, datasetPath).replace(/\\/g, "/"),
      caseIds: selected.map(item => item.id), configFingerprint, ...configuration });
  }
  const results: ScoredCase[] = [];
  try {
    for (const item of selected) {
      const caseDir = path.join(outputRoot, item.id);
      const resultPath = path.join(caseDir, "result.json");
      if (fs.existsSync(resultPath)) { results.push(readJson(resultPath)); continue; }
      if (fs.existsSync(caseDir)) throw new Error(`Incomplete case directory ${item.id}; manual inspection required before resume`);
      fs.mkdirSync(caseDir);
      let run: Awaited<ReturnType<typeof runCase>> | undefined;
      let error: string | undefined;
      try { run = await runCase(item, caseDir); }
      catch (cause) { error = cause instanceof Error ? cause.message : "Unknown isolated evaluation error"; }
      if (run) writeNew(path.join(caseDir, "run.json"), run);
      const result = scoreCase(item, run, undefined, error);
      writeNew(resultPath, result);
      results.push(result);
      console.log(`${item.id}: ${result.state}${error ? ` (${error})` : ""}`);
    }
  } finally {
    if (computeSourceManifest(path.join(root, "apps", "minishop")).fingerprint !== primaryFingerprint) throw new Error("Primary MiniShop source changed during evaluation");
  }
  const report = { schemaVersion: "2.0", generatedAt: new Date().toISOString(), datasetHash: dataset.datasetHash,
    manifestHash: createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex"), ...aggregateCases(results), results };
  writeNew(path.join(outputRoot, "aggregate.json"), report);
  console.log(JSON.stringify({ outputRoot, denominator: report.denominator, metrics: report.metrics }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
