import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { extractZipArchive } from "../services/api/src/utils/zip";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (relative: string) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, ""));
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const checks: { name: string; passed: boolean; detail: string }[] = [];
const check = (name: string, condition: unknown, detail: string) => {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
};

const caseId = "case-1791917776888-hvza72c3";
const reproductionRunId = "8dca2a60-8416-40e4-a4e6-e7de42948cf4";
const bugCase = readJson(`data/cases/${caseId}.json`);
const review = readJson("artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/live-review-result.json");
const repair = readJson("artifacts/arbitrary-reproduction/ar6-repair-proof/reference-result.json");
const scorecard = readJson("artifacts/arbitrary-reproduction/ar7-evaluation/evaluation-report.json");
const acceptedPath = path.resolve(bugCase.reproduction.testFile);

check("structured report complete", bugCase.reportCompleteness?.complete && bugCase.report.steps.length > 0, "demo case must retain complete report fields");
check("reviewed reproduction state", bugCase.status === "REPRODUCED" && review.run?.state === "REPRODUCED", "case and durable generation run must both be REPRODUCED");
check("accepted test exists", fs.existsSync(acceptedPath), acceptedPath);
const acceptedHash = sha256(fs.readFileSync(acceptedPath));
check("accepted test hash", acceptedHash === bugCase.reproduction.generatedTest.compiledTestHash, `${acceptedHash} must equal reviewed compiled hash`);
check("reproduction provenance", bugCase.reproduction.generatedTest.reproductionRunId === reproductionRunId, "case must point to the reviewed generation run");
check("structured baseline failure", bugCase.reproduction.lastRun.outcome === "ASSERTION_FAILED", "demo baseline must be a behavior assertion failure");
check("same-test repair", repair.state === "VERIFIED" && repair.sameTestFingerprint && repair.testFingerprint === bugCase.reproduction.lastRun.testFingerprint, "AR6 must pass the identical accepted test");
check("required regressions", repair.requiredChecks.length >= 3 && repair.requiredChecks.every((item: any) => item.passed && item.exitCode === 0), "typecheck, build, and unit checks must pass");
check("proof bundle exists", fs.existsSync(repair.proofBundle), repair.proofBundle);
const extracted = extractZipArchive(fs.readFileSync(repair.proofBundle));
check("proof bundle structure", extracted.has("manifest.json") && extracted.has("proof-report.md"), "manifest and human-readable proof report are required");
const manifest = JSON.parse(extracted.get("manifest.json")!.toString("utf8"));
check("proof provenance", manifest.reproductionProvenance?.reproductionRunId === reproductionRunId && manifest.reproductionProvenance?.compiledTestHash === acceptedHash, "proof must identify the accepted generation run and bytes");
check("scorecard integrity", scorecard.dataset?.prospectiveArbitraryReports?.integrityVerified === true, "AR7 report must verify the frozen split hash");
check("held-out result retained", scorecard.dataset?.prospectiveArbitraryReports?.executed === true && scorecard.prospectiveHeldOut?.denominator === 4, "AR7 must retain the single frozen four-report held-out execution");
for (const relative of ["docs/dynamic-demo-script.md", "docs/portfolio-release.md", "artifacts/arbitrary-reproduction/ar7-evaluation/evaluation-report.md"]) {
  check(`release artifact ${relative}`, fs.existsSync(path.join(root, relative)) && fs.statSync(path.join(root, relative)).size > 0, "file must exist and be non-empty");
}

const result = { schemaVersion: "1.0", checkedAt: new Date().toISOString(), readyForRecordedLocalDemo: true,
  claimBoundary: "Configured local MiniShop; live generation evidence plus deterministic reference repair proposal with real browser/regression/proof verification.",
  caseId, reproductionRunId, repairRunId: repair.runId, acceptedTestHash: acceptedHash, testFingerprint: repair.testFingerprint,
  proofBundle: repair.proofBundle, checks };
const out = path.join(root, "artifacts", "arbitrary-reproduction", "ar7-evaluation", "demo-readiness.json");
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ output: out, ...result }, null, 2));
