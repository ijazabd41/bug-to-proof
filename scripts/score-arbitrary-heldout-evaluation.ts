import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { aggregateCases, scoreCase, validateDataset, type EvaluationDataset, type EvaluationReview } from "./arbitrary-evaluation-core";

const root = path.resolve(import.meta.dirname, "..");
const allowedRoot = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-evaluation");
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run arbitrary:evaluate:score -- artifacts/arbitrary-reproduction/prospective-evaluation/<run-id>");
const directory = path.resolve(root, input);
if (!directory.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Evaluation directory is outside prospective artifacts");
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const manifestPath = path.join(directory, "manifest.json");
const manifest = readJson(manifestPath);
const datasetPath = path.resolve(root, manifest.datasetPath);
if (!datasetPath.startsWith(`${path.join(root, "data", "evals")}${path.sep}`)) throw new Error("Manifest dataset path is invalid");
const dataset = readJson(datasetPath) as EvaluationDataset;
validateDataset(dataset);
if (dataset.datasetHash !== manifest.datasetHash) throw new Error("Dataset changed since the live run");
const selected = dataset.cases.filter(item => item.split === manifest.split);
if (selected.length !== manifest.caseIds.length || selected.some((item, index) => item.id !== manifest.caseIds[index])) throw new Error("Manifest case list does not match frozen dataset");

const results = selected.map(item => {
  const caseDir = path.join(directory, item.id);
  const recorded = readJson(path.join(caseDir, "result.json"));
  const runPath = path.join(caseDir, "run.json");
  const reviewPath = path.join(caseDir, "review.json");
  const run = fs.existsSync(runPath) ? readJson(runPath) : undefined;
  const review = fs.existsSync(reviewPath) ? readJson(reviewPath) as EvaluationReview : undefined;
  if (review && (review.decision !== "MATCH" && review.decision !== "MISMATCH")) throw new Error(`Invalid review decision for ${item.id}`);
  const scored = scoreCase(item, run, review, recorded.error);
  if (review && scored.reviewStatus === "PENDING") throw new Error(`Review identity does not match frozen candidate for ${item.id}`);
  if (scored.state !== recorded.state || scored.attempts !== recorded.attempts) throw new Error(`Frozen run differs from recorded result for ${item.id}`);
  return scored;
});
const report = { schemaVersion: "2.0", generatedAt: new Date().toISOString(), datasetHash: dataset.datasetHash,
  manifestHash: createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex"), ...aggregateCases(results), results };
const output = path.join(directory, `reviewed-scorecard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, denominator: report.denominator, metrics: report.metrics }, null, 2));
