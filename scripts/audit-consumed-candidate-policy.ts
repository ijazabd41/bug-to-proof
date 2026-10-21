import fs from "node:fs";
import path from "node:path";
import { validateCandidateAgainstDiscovery } from "../services/api/src/reproduction/candidatePolicy";

const root = path.resolve(import.meta.dirname, "..");
const outputArg = process.argv[2];
if (!outputArg) throw new Error("Provide the retained prospective evaluation directory");
const output = path.resolve(root, outputArg);
const allowed = path.join(root, "artifacts", "arbitrary-reproduction", "prospective-evaluation");
if (!output.startsWith(`${allowed}${path.sep}`)) throw new Error("Evaluation directory is outside prospective artifacts");
const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
for (const id of manifest.caseIds as string[]) {
  const caseDir = path.join(output, id);
  const run = JSON.parse(fs.readFileSync(path.join(caseDir, "run.json"), "utf8"));
  const discovery = JSON.parse(fs.readFileSync(path.join(caseDir, "generated", run.discovery.artifactPath), "utf8"));
  const reviewFile = path.join(caseDir, "review.json");
  const review = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, "utf8")) : undefined;
  const candidate = run.attempts.find((attempt: { definitionHash?: string }) => attempt.definitionHash === review?.definitionHash)
    ?? run.attempts.find((attempt: { definition?: unknown }) => attempt.definition);
  if (!candidate?.definition) { console.log(`${id}: no valid prior definition`); continue; }
  const result = validateCandidateAgainstDiscovery(candidate.definition, discovery);
  console.log(JSON.stringify({ id, priorReview: review?.decision ?? "NONE", currentPolicyAccepts: result.ok, findings: result.findings }));
}
