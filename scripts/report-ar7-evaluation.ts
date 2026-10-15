import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "artifacts", "arbitrary-reproduction", "ar7-evaluation");
const read = (relative: string) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, ""));
const percent = (count: number, denominator: number) => denominator ? Number((count * 100 / denominator).toFixed(1)) : 0;

const initial = read("artifacts/arbitrary-reproduction/ar4-generation-execution/live-acceptance-aggregate.json");
const acceptance = read("artifacts/arbitrary-reproduction/ar4-generation-execution/trusted-target-runtime-retries/acceptance-summary.json");
const review = read("artifacts/arbitrary-reproduction/ar5-review-frozen-baseline/live-review-result.json");
const repair = read("artifacts/arbitrary-reproduction/ar6-repair-proof/reference-result.json");
const repairCases = read("data/evals/repair-cases.json");
const prospective = read("data/evals/arbitrary-reproduction-release.json");
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
const prospectiveHash = createHash("sha256").update(canonical({ schemaVersion: prospective.schemaVersion, frozenAt: prospective.frozenAt, policy: prospective.policy, cases: prospective.cases })).digest("hex");
if (prospectiveHash !== prospective.datasetHash) throw new Error(`Frozen arbitrary-report dataset hash mismatch: ${prospectiveHash}`);
const heldOutRoot = path.join(root, "artifacts", "arbitrary-reproduction", "ar7-evaluation");
const heldOutDirectories = fs.existsSync(heldOutRoot) ? fs.readdirSync(heldOutRoot).filter(name => name.startsWith("live-held-out-") && fs.existsSync(path.join(heldOutRoot, name, "aggregate.json"))).sort() : [];
const heldOutDirectory = heldOutDirectories.at(-1);
const heldOut = heldOutDirectory ? read(`artifacts/arbitrary-reproduction/ar7-evaluation/${heldOutDirectory}/aggregate.json`) : undefined;
if (heldOut && heldOut.datasetHash !== prospectiveHash) throw new Error("Held-out result dataset hash does not match the frozen dataset");

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  claimBoundary: {
    target: "Configured local MiniShop application only",
    liveGeneration: true,
    humanReviewedFrozenBaseline: true,
    repairProposalMode: "deterministic reference proposal",
    liveModelRepairExecuted: false,
    reason: "External source transmission was not authorized.",
    prospectiveHeldOutExecuted: Boolean(heldOut)
  },
  dataset: {
    repairCases: { total: repairCases.length, dev: repairCases.filter((x: any) => x.split === "dev").length, heldOut: repairCases.filter((x: any) => x.split === "held-out").length },
    prospectiveArbitraryReports: { total: prospective.cases.length, dev: prospective.cases.filter((x: any) => x.split === "dev").length, heldOut: prospective.cases.filter((x: any) => x.split === "held-out").length, frozenAt: prospective.frozenAt, datasetHash: prospectiveHash, integrityVerified: true, executed: Boolean(heldOut), resultArtifact: heldOutDirectory ? `artifacts/arbitrary-reproduction/ar7-evaluation/${heldOutDirectory}/aggregate.json` : undefined },
    categories: [...new Set(repairCases.map((x: any) => x.id.replace(/^case-\d+-/, "")))]
  },
  historicalLiveGeneration: {
    cohort: "AR4 initial live acceptance",
    completeness: { count: initial.reportsSubmitted, denominator: initial.reportsSubmitted, rate: percent(initial.reportsSubmitted, initial.reportsSubmitted) },
    usableProviderResponse: { count: initial.providerSuccessfulRuns, denominator: initial.runsStarted, rate: percent(initial.providerSuccessfulRuns, initial.runsStarted) },
    validCandidate: { count: initial.validCandidates, denominator: initial.providerOutputs, rate: percent(initial.validCandidates, initial.providerOutputs) },
    executableCandidate: { count: initial.executableCandidates, denominator: initial.providerOutputs, rate: percent(initial.executableCandidates, initial.providerOutputs) },
    relevantReproduction: { count: initial.assertionFailures, denominator: initial.runsStarted, rate: percent(initial.assertionFailures, initial.runsStarted) },
    infrastructureError: { count: initial.infrastructureFailures, denominator: initial.runsStarted, rate: percent(initial.infrastructureFailures, initial.runsStarted) },
    unsupported: { count: initial.unsupportedOutcomes, denominator: initial.runsStarted, rate: percent(initial.unsupportedOutcomes, initial.runsStarted) },
    attemptsPerRun: initial.attemptsPerRun,
    latencyAndUsage: "Per-attempt duration is retained in run evidence; provider token usage and cost were unavailable."
  },
  trustedTargetAcceptance: {
    cohort: "AR4 discovery-bound runtime retries",
    completeReports: { count: acceptance.reportsSubmitted, denominator: acceptance.reportsSubmitted, rate: 100 },
    validCandidate: { count: acceptance.validCandidates, denominator: acceptance.reportsSubmitted, rate: percent(acceptance.validCandidates, acceptance.reportsSubmitted) },
    executableCandidate: { count: acceptance.executableCandidates, denominator: acceptance.reportsSubmitted, rate: percent(acceptance.executableCandidates, acceptance.reportsSubmitted) },
    relevantReproduction: { count: acceptance.structuredAssertionFailures, denominator: acceptance.reportsSubmitted, rate: percent(acceptance.structuredAssertionFailures, acceptance.reportsSubmitted) },
    passingBaseline: { count: acceptance.passingBaselines, denominator: acceptance.reportsSubmitted, rate: percent(acceptance.passingBaselines, acceptance.reportsSubmitted) },
    humanAcceptance: { count: review.run?.state === "REPRODUCED" ? 1 : 0, denominator: acceptance.structuredAssertionFailures, rate: percent(review.run?.state === "REPRODUCED" ? 1 : 0, acceptance.structuredAssertionFailures) },
    sourceIdentityUnchanged: acceptance.sourceFingerprintBefore === acceptance.sourceFingerprintAfter
  },
  endToEndReference: {
    verifiedRepair: { count: repair.state === "VERIFIED" ? 1 : 0, denominator: 1, rate: repair.state === "VERIFIED" ? 100 : 0 },
    baselineOutcome: repair.baselineOutcome,
    postPatchOutcome: repair.postPatchOutcome,
    identicalTest: repair.sameTestFingerprint,
    requiredChecksPassed: repair.requiredChecks.every((x: any) => x.passed),
    proofManifestVerified: repair.proofManifestVerified,
    limitation: "The proposal was deterministic reference output; browser execution, regression gates, and proof verification were real."
  },
  prospectiveHeldOut: heldOut ? { denominator: heldOut.denominator, ...heldOut.metrics,
    validCandidateRate: percent(heldOut.metrics.validCandidates, heldOut.denominator), executableCandidateRate: percent(heldOut.metrics.executableCandidates, heldOut.denominator),
    relevantReproductionRate: percent(heldOut.metrics.relevantReproductions, heldOut.denominator), infrastructureErrorRate: percent(heldOut.metrics.infrastructureErrors, heldOut.denominator),
    unsupportedRate: percent(heldOut.metrics.unsupported, heldOut.denominator), tokenUsageAndCost: "unavailable" } : { executed: false },
  failuresAndBoundaries: [
    "The initial live cohort produced no relevant assertion failure despite four executable candidates.",
    "Provider response failures and invalid candidates remain in the denominator.",
    "Only one of two review-eligible assertion failures received human acceptance and frozen-baseline confirmation.",
    ...(heldOut ? ["The frozen held-out cohort produced no relevant reproduction: one report correctly passed on the current source, one exhausted retries on selector/action and empty-response failures, and two were blocked by provider connectivity."] : ["No prospective held-out arbitrary-report evaluation has been executed after the split freeze."]),
    "No live-model arbitrary-source repair was executed because external source transmission was not authorized."
  ]
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "evaluation-report.json"), JSON.stringify(report, null, 2) + "\n");
const md = `# AR7 evaluation scorecard\n\nGenerated: ${report.generatedAt}\n\n| Measure | Result |\n| --- | --- |\n| Initial usable provider responses | ${report.historicalLiveGeneration.usableProviderResponse.count}/${report.historicalLiveGeneration.usableProviderResponse.denominator} (${report.historicalLiveGeneration.usableProviderResponse.rate}%) |\n| Initial valid candidates | ${report.historicalLiveGeneration.validCandidate.count}/${report.historicalLiveGeneration.validCandidate.denominator} (${report.historicalLiveGeneration.validCandidate.rate}%) |\n| Initial executable candidates | ${report.historicalLiveGeneration.executableCandidate.count}/${report.historicalLiveGeneration.executableCandidate.denominator} (${report.historicalLiveGeneration.executableCandidate.rate}%) |\n| Trusted-target executable candidates | ${report.trustedTargetAcceptance.executableCandidate.count}/${report.trustedTargetAcceptance.executableCandidate.denominator} (${report.trustedTargetAcceptance.executableCandidate.rate}%) |\n| Trusted-target relevant reproductions | ${report.trustedTargetAcceptance.relevantReproduction.count}/${report.trustedTargetAcceptance.relevantReproduction.denominator} (${report.trustedTargetAcceptance.relevantReproduction.rate}%) |\n| Human-accepted reproduced baselines | ${report.trustedTargetAcceptance.humanAcceptance.count}/${report.trustedTargetAcceptance.humanAcceptance.denominator} (${report.trustedTargetAcceptance.humanAcceptance.rate}%) |\n| End-to-end verified reference repairs | ${report.endToEndReference.verifiedRepair.count}/${report.endToEndReference.verifiedRepair.denominator} (${report.endToEndReference.verifiedRepair.rate}%) |\n| Frozen held-out valid candidates | ${heldOut ? `${report.prospectiveHeldOut.validCandidates}/${report.prospectiveHeldOut.denominator} (${report.prospectiveHeldOut.validCandidateRate}%)` : "not executed"} |\n| Frozen held-out executable candidates | ${heldOut ? `${report.prospectiveHeldOut.executableCandidates}/${report.prospectiveHeldOut.denominator} (${report.prospectiveHeldOut.executableCandidateRate}%)` : "not executed"} |\n| Frozen held-out relevant reproductions | ${heldOut ? `${report.prospectiveHeldOut.relevantReproductions}/${report.prospectiveHeldOut.denominator} (${report.prospectiveHeldOut.relevantReproductionRate}%)` : "not executed"} |\n| Frozen held-out infrastructure errors | ${heldOut ? `${report.prospectiveHeldOut.infrastructureErrors}/${report.prospectiveHeldOut.denominator} (${report.prospectiveHeldOut.infrastructureErrorRate}%)` : "not executed"} |\n\n## Claim boundary\n\nThis evidence applies only to the configured local MiniShop. Live generation and the reviewed frozen baseline are real. The repair proposal used for the end-to-end reference was deterministic; its browser verification, regression gates, and proof-bundle checks were real. The prospective held-out arbitrary-report set ${heldOut ? "was executed once without post-freeze prompt tuning" : "is frozen but not yet executed"}.\n\n## Retained failures\n\n${report.failuresAndBoundaries.map(x => `- ${x}`).join("\n")}\n`;
fs.writeFileSync(path.join(outDir, "evaluation-report.md"), md);
console.log(JSON.stringify({ output: outDir, report }, null, 2));
