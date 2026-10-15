import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type EvalCase = { id: string; split: "dev" | "held-out"; category: string; report: Record<string, unknown> };
type Dataset = { schemaVersion: string; frozenAt: string; status: string; policy: Record<string, unknown>; cases: EvalCase[]; datasetHash: string };
const root = path.resolve(import.meta.dirname, "..");
const datasetPath = path.join(root, "data", "evals", "arbitrary-reproduction-release.json");
const api = process.env.BTP_API_URL ?? "http://127.0.0.1:3001/api";
const args = new Set(process.argv.slice(2));
if (!args.has("--confirm-live")) throw new Error("Live provider evaluation requires --confirm-live");
const split = args.has("--all") ? undefined : "held-out";
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
const hashDataset = (data: Dataset) => createHash("sha256").update(canonical({ schemaVersion: data.schemaVersion, frozenAt: data.frozenAt, policy: data.policy, cases: data.cases })).digest("hex");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8").replace(/^\uFEFF/, "")) as Dataset;
const observedHash = hashDataset(dataset);
if (observedHash !== dataset.datasetHash) throw new Error(`Frozen dataset hash mismatch: expected ${dataset.datasetHash}, got ${observedHash}`);
if (dataset.status !== "FROZEN_FOR_FUTURE_EVALUATION" || dataset.policy.promptTuningAfterFreezeAllowed !== false) throw new Error("Dataset is not frozen");

const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init); const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const selected = dataset.cases.filter(item => !split || item.split === split);
  const terminal = new Set(["AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED"]);
  const outputRoot = path.join(root, "artifacts", "arbitrary-reproduction", "ar7-evaluation", `live-${split ?? "all"}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const results: any[] = [];
  for (const item of selected) {
  const created = await request(`${api}/cases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.report) });
  const started = await request(`${api}/cases/${created.id}/reproduction-runs`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const deadline = Date.now() + 10 * 60_000; let run: any;
  do { await sleep(2_000); run = await request(`${api}/reproduction-runs/${started.reproductionRunId}`); if (Date.now() > deadline) throw new Error(`Timed out: ${item.id}`); }
  while (!terminal.has(run.state));
  const itemDir = path.join(outputRoot, item.id); fs.mkdirSync(itemDir, { recursive: true });
  fs.writeFileSync(path.join(itemDir, "case.json"), JSON.stringify(created, null, 2) + "\n");
  fs.writeFileSync(path.join(itemDir, "run.json"), JSON.stringify(run, null, 2) + "\n");
  const result = { evaluationId: item.id, split: item.split, category: item.category, caseId: created.id, reproductionRunId: run.reproductionRunId, state: run.state,
    stopReason: run.stopReason, attempts: run.attempts.length, classifications: run.attempts.map((x: any) => x.classification), responseShapes: run.attempts.map((x: any) => x.responseShape),
    validCandidate: run.attempts.some((x: any) => !!x.definitionHash), executableCandidate: run.attempts.some((x: any) => ["ASSERTION_FAILED", "BASELINE_PASSED"].includes(x.classification)),
    relevantReproduction: run.state === "AWAITING_TEST_REVIEW" || run.state === "REPRODUCED", infrastructureError: run.state === "BLOCKED" && (run.stopReason === "Generation provider failed" || run.attempts.some((x: any) => x.failureKind && x.failureKind !== "SELECTOR_OR_ACTION_ERROR")),
    unsupported: run.state === "UNSUPPORTED", durationMs: run.attempts.reduce((sum: number, x: any) => sum + (x.durationMs ?? 0), 0), usage: run.attempts.map((x: any) => x.usage ?? null) };
    results.push(result); fs.writeFileSync(path.join(itemDir, "summary.json"), JSON.stringify(result, null, 2) + "\n"); console.log(`${item.id}: ${run.state}`);
  }
  const count = (fn: (x: any) => boolean) => results.filter(fn).length;
  const report = { schemaVersion: "1.0", generatedAt: new Date().toISOString(), datasetHash: observedHash, frozenAt: dataset.frozenAt, split: split ?? "all", denominator: results.length,
  metrics: { validCandidates: count(x => x.validCandidate), executableCandidates: count(x => x.executableCandidate), relevantReproductions: count(x => x.relevantReproduction), infrastructureErrors: count(x => x.infrastructureError), unsupported: count(x => x.unsupported) }, results };
  fs.writeFileSync(path.join(outputRoot, "aggregate.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outputRoot, ...report }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
