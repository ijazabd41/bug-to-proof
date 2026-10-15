import fs from "fs";
import path from "path";
import { createAndStartRepairRun, reviewAndApplyRepairRun } from "../services/api/src/ai/repair/repairService";
import { buildProofBundle } from "../services/api/src/ai/repair/proofBundle";
import { extractZipArchive } from "../services/api/src/utils/zip";
import { ARTIFACTS_DIR } from "../services/api/src/utils/paths";

const caseId = process.env.BTP_CASE_ID ?? "case-1791917776888-hvza72c3";
const outputDir = path.join(ARTIFACTS_DIR, "arbitrary-reproduction", "ar6-repair-proof");
fs.mkdirSync(outputDir, { recursive: true });

async function main() {
  const started = await createAndStartRepairRun(caseId, {
    mode: "simulated",
    maxAttempts: 1,
    timeoutMs: 300_000,
    simulatedProposal: {
      diagnosis: "The cart UI renders the merchandise subtotal as Total even though shipping is calculated and displayed separately.",
      assumptions: ["The accepted reproduction requires shipping to be included in the displayed total."],
      rationale: "Add the already-computed shipping fee to the displayed cart total without changing item subtotal or shipping threshold behavior.",
      edits: [{
        relativePath: "src/components/Cart.tsx",
        oldContent: '<span data-testid="cart-total">${cartTotal.toFixed(2)}</span>',
        newContent: '<span data-testid="cart-total">${(cartTotal + shippingFee).toFixed(2)}</span>',
      }],
    },
  });
  if (started.state !== "AWAITING_REVIEW" || !started.proposal) throw new Error(`Expected AWAITING_REVIEW, received ${started.state}: ${started.stopReason ?? ""}`);
  const verified = await reviewAndApplyRepairRun(started.runId, {
    proposalId: started.proposal.proposalId,
    proposalHash: started.proposal.proposalHash,
    decision: "APPROVED",
    reviewerNotes: "Deterministic AR6 reference verification of the accepted arbitrary reproduction.",
  });
  if (verified.state !== "VERIFIED") throw new Error(`Expected VERIFIED, received ${verified.state}: ${verified.stopReason ?? ""}`);
  const bundle = await buildProofBundle(verified.runId);
  const extracted = extractZipArchive(bundle.buffer);
  if (!bundle.manifest.verified || !extracted.has("manifest.json") || !extracted.has("proof-report.md")) throw new Error("Proof bundle failed independent extraction/verification");
  const zipPath = path.join(outputDir, bundle.filename);
  fs.writeFileSync(zipPath, bundle.buffer);
  const summary = {
    caseId, runId: verified.runId, state: verified.state,
    baselineOutcome: verified.baselineRun?.outcome,
    postPatchOutcome: verified.postPatchRun?.outcome,
    sameTestFingerprint: verified.baselineRun?.testFingerprint === verified.postPatchRun?.testFingerprint,
    testFingerprint: verified.testFingerprint,
    reproductionProvenance: verified.inputs?.reproductionTest.provenance,
    proposalId: verified.proposal?.proposalId,
    proposalHash: verified.proposal?.proposalHash,
    reviewDecision: verified.review?.decision,
    requiredChecks: verified.requiredChecks.map(check => ({ type: check.type, passed: check.passed, exitCode: check.exitCode })),
    proofBundle: zipPath,
    proofManifestVerified: bundle.manifest.verified,
    proofManifestProvenance: bundle.manifest.reproductionProvenance,
    extractedEntries: extracted.size,
  };
  fs.writeFileSync(path.join(outputDir, "reference-result.json"), JSON.stringify(summary, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
