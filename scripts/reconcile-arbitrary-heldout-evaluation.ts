import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requested = process.argv[2];
if (!requested) throw new Error("Usage: tsx scripts/reconcile-arbitrary-heldout-evaluation.ts <artifact-directory>");
const directory = path.resolve(root, requested);
const contained = path.resolve(root, "artifacts", "arbitrary-reproduction", "ar7-evaluation");
if (!directory.startsWith(`${contained}${path.sep}`) || !fs.existsSync(directory)) throw new Error("Evaluation directory is outside AR7 artifacts or missing");
const prior = JSON.parse(fs.readFileSync(path.join(directory, "aggregate.json"), "utf8"));
const results = fs.readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).map(item => {
  const run = JSON.parse(fs.readFileSync(path.join(directory, item.name, "run.json"), "utf8"));
  const started = Date.parse(run.createdAt); const ended = Date.parse(run.completedAt ?? run.updatedAt);
  return { evaluationId: item.name, split: "held-out", category: item.name.replace("ar-heldout-", ""), caseId: run.caseId, reproductionRunId: run.reproductionRunId,
    state: run.state, stopReason: run.stopReason, attempts: run.attempts.length, classifications: run.attempts.map((x: any) => x.classification),
    responseShapes: run.attempts.map((x: any) => x.responseShape ?? null), validCandidate: run.attempts.some((x: any) => !!x.definitionHash),
    executableCandidate: run.attempts.some((x: any) => ["ASSERTION_FAILED", "BASELINE_PASSED"].includes(x.classification)),
    relevantReproduction: ["AWAITING_TEST_REVIEW", "REPRODUCED"].includes(run.state),
    infrastructureError: run.state === "BLOCKED" && (run.stopReason === "Generation provider failed" || run.attempts.some((x: any) => x.failureKind && x.failureKind !== "SELECTOR_OR_ACTION_ERROR")),
    unsupported: run.state === "UNSUPPORTED", durationMs: Number.isFinite(started) && Number.isFinite(ended) ? ended - started : null,
    usage: run.attempts.map((x: any) => x.usage ?? null) };
});
const count = (field: string) => results.filter((item: any) => item[field]).length;
const report = { ...prior, reconciledAt: new Date().toISOString(), denominator: results.length,
  metrics: { validCandidates: count("validCandidate"), executableCandidates: count("executableCandidate"), relevantReproductions: count("relevantReproduction"), infrastructureErrors: count("infrastructureError"), unsupported: count("unsupported") }, results };
const output = path.join(directory, `reconciled-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, metrics: report.metrics }, null, 2));
