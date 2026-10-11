import fs from "fs";
import path from "path";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../services/api/src/utils/paths";
import { readCase } from "../services/api/src/storage/caseStore";
import { testFingerprint } from "../services/api/src/runner/integrity";
import { computeProposalHash } from "../services/api/src/ai/repair/contracts";
import { createAndStartRepairRun, reviewAndApplyRepairRun } from "../services/api/src/ai/repair/repairService";
import type { ModelProposal } from "../services/api/src/ai/repair/contracts";

async function runRealBrowserWorkflow() {
  console.log("========================================================================");
  console.log("   Real Browser Failure-to-Pass Workflow Verification via LangGraph     ");
  console.log("========================================================================");

  const caseId = "case-001";
  const bCase = readCase(caseId);
  if (!bCase) {
    throw new Error(`Case ${caseId} not found in case store`);
  }

  const reproductionFile = bCase.reproduction.testFile;
  const fp = testFingerprint(reproductionFile);
  console.log(`[Browser Workflow] Case: ${caseId} ("${bCase.title}")`);
  console.log(`[Browser Workflow] Reproduction Test: ${reproductionFile}`);
  console.log(`[Browser Workflow] Test Fingerprint: ${fp}`);

  const buggySnippet = "  total: () => get().items[0]?.price ?? 0,";
  const fixedSnippet = "  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),";

  const edits = [
    {
      relativePath: "src/store/cartStore.ts",
      oldContent: buggySnippet,
      newContent: fixedSnippet,
    },
  ];

  const proposalHash = computeProposalHash(edits, "Cart total only reads first item price", "Sum all items in cart");
  const proposal: ModelProposal = {
    schemaVersion: "1.0",
    proposalId: `prop-browser-flow-${Date.now()}`,
    diagnosis: "Cart total only reads first item price instead of summing all items",
    assumptions: ["Standard cart reduction over item price and quantity"],
    rationale: "Sum all item prices multiplied by quantities",
    edits,
    unifiedDiff: "--- src/store/cartStore.ts\n+++ src/store/cartStore.ts\n@@\n-  total: () => get().items[0]?.price ?? 0,\n+  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),\n",
    proposalHash,
    proposedAt: new Date().toISOString(),
  };

  // Run with real browser reproduction (no mock runner passed for run or startApp!)
  console.log("\n[Step 1] Starting LangGraph Repair Run with real browser reproduction & isolated Vite app...");
  const run = await createAndStartRepairRun(
    caseId,
    {
      mode: "dynamic",
      maxAttempts: 1,
      seedDefects: [
        {
          relativePath: "src/store/cartStore.ts",
          originalSnippet: fixedSnippet,
          defectiveSnippet: buggySnippet,
        },
      ],
    },
    {
      // Provide deterministic proposal generator while letting LangGraph use real startApp, real browser Playwright run, and real regression checks
      generate: async () => proposal,
    }
  );

  console.log(`[Step 1 Complete] Run ID: ${run.runId}`);
  console.log(`  State: ${run.state}`);
  console.log(`  Baseline Outcome: ${run.baselineRun?.outcome} (Passed: ${run.baselineRun?.passed})`);
  console.log(`  Baseline Test IDs: ${JSON.stringify(run.baselineRun?.testIds)}`);
  console.log(`  Baseline Report Hash: ${run.baselineRun?.reportHash}`);
  console.log(`  Baseline Expected: "${run.baselineRun?.expected}"`);
  console.log(`  Baseline Actual: "${run.baselineRun?.actual}"`);
  console.log(`  Proposal ID: ${run.proposal?.proposalId}`);

  if (run.state !== "AWAITING_REVIEW" || !run.proposal) {
    throw new Error(`Expected run to pause at AWAITING_REVIEW, got ${run.state} (${run.stopReason})`);
  }

  // Step 2: Review and Apply Approved Patch with exact binding
  console.log("\n[Step 2] Submitting exact approval review and resuming LangGraph execution...");
  const finalized = await reviewAndApplyRepairRun(
    run.runId,
    {
      proposalId: run.proposal.proposalId,
      proposalHash: run.proposal.proposalHash,
      decision: "APPROVED",
      reviewerNotes: "Verified exact patch in browser test run",
    }
  );

  console.log(`[Step 2 Complete] Final State: ${finalized.state}`);
  console.log(`  Post-Patch Outcome: ${finalized.postPatchRun?.outcome} (Passed: ${finalized.postPatchRun?.passed})`);
  console.log(`  Post-Patch Test IDs: ${JSON.stringify(finalized.postPatchRun?.testIds)}`);
  console.log(`  Post-Patch Report Hash: ${finalized.postPatchRun?.reportHash}`);
  console.log(`  Post-Patch Expected: "${finalized.postPatchRun?.expected}"`);
  console.log(`  Post-Patch Actual: "${finalized.postPatchRun?.actual}"`);
  console.log(`  Regression Checks: ${finalized.requiredChecks.length} checks (${finalized.requiredChecks.every((c) => c.passed) ? "ALL PASSED" : "FAILED"})`);

  for (const check of finalized.requiredChecks) {
    console.log(`    - [${check.passed ? "PASS" : "FAIL"}] ${check.name} (${check.command}): exitCode=${check.exitCode}, duration=${check.durationMs}ms`);
  }

  if (finalized.state !== "VERIFIED") {
    throw new Error(`Real browser workflow failed to verify: state=${finalized.state}, error=${finalized.error}`);
  }

  // Save evidence
  const evidenceDir = path.join(ARTIFACTS_DIR, "system-testing", "real-browser-verification");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const report = {
    testName: "REAL-BROWSER-FAILURE-TO-PASS",
    runId: finalized.runId,
    caseId,
    timestamp: new Date().toISOString(),
    status: finalized.state,
    baseline: {
      outcome: finalized.baselineRun?.outcome,
      expected: finalized.baselineRun?.expected,
      actual: finalized.baselineRun?.actual,
      reportHash: finalized.baselineRun?.reportHash,
      testIds: finalized.baselineRun?.testIds,
    },
    postPatch: {
      outcome: finalized.postPatchRun?.outcome,
      expected: finalized.postPatchRun?.expected,
      actual: finalized.postPatchRun?.actual,
      reportHash: finalized.postPatchRun?.reportHash,
      testIds: finalized.postPatchRun?.testIds,
    },
    regressionChecks: finalized.requiredChecks,
    proposal: {
      proposalId: finalized.proposal?.proposalId,
      proposalHash: finalized.proposal?.proposalHash,
      diff: finalized.proposal?.unifiedDiff,
    },
  };

  fs.writeFileSync(path.join(evidenceDir, "browser-workflow-result.json"), JSON.stringify(report, null, 2), "utf-8");

  // Build and validate real proof bundle ZIP
  console.log("\n[Step 3] Building and validating genuine Proof Bundle ZIP export...");
  const { buildProofBundle, sha256 } = await import("../services/api/src/ai/repair/proofBundle");
  const { extractZipArchive } = await import("../services/api/src/utils/zip");

  const bundle = await buildProofBundle(finalized.runId);
  const bundleZipPath = path.join(ARTIFACTS_DIR, "runs", finalized.runId, bundle.filename);
  fs.writeFileSync(bundleZipPath, bundle.buffer);

  console.log(`  Proof Bundle ZIP written to: ${bundleZipPath} (${(bundle.buffer.length / 1024).toFixed(1)} KB)`);
  console.log(`  Manifest verified: ${bundle.manifest.verified}`);
  console.log(`  Included files: ${bundle.manifest.files.length}`);

  // Extract archive and validate every single entry hash against extracted bytes
  const extractedMap = extractZipArchive(bundle.buffer);
  let allChecksumsMatch = true;
  for (const entry of bundle.manifest.files) {
    if (!extractedMap.has(entry.path)) {
      throw new Error(`Extracted ZIP missing manifest file entry: ${entry.path}`);
    }
    const extractedBytes = extractedMap.get(entry.path)!;
    const computedHash = sha256(extractedBytes);
    if (computedHash !== entry.sha256) {
      throw new Error(`SHA-256 hash mismatch for ${entry.path}: manifest ${entry.sha256} vs extracted ${computedHash}`);
    }
  }

  console.log(`  Independent extraction & byte-hash validation: 100% MATCH (${extractedMap.size} entries verified)`);

  console.log("\n========================================================================");
  console.log(` Real Browser Workflow: VERIFIED`);
  console.log(` Full evidence saved to: ${path.join(evidenceDir, "browser-workflow-result.json")}`);
  console.log(` Proof Bundle: ${bundleZipPath}`);
  console.log("========================================================================");
}

runRealBrowserWorkflow().catch((err) => {
  console.error("Real browser workflow failed:", err);
  process.exit(1);
});
