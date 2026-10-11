import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../services/api/src/utils/paths";

// Load .env then enable LLM
config({ path: path.join(WORKSPACE_ROOT, ".env") });
process.env.LLM_ENABLED = "true";

import { writeCase } from "../services/api/src/storage/caseStore";
import { createAndStartRepairRun, reviewAndApplyRepairRun } from "../services/api/src/ai/repair/repairService";
import type { BugCase } from "@bug-to-proof/shared-types";

async function main() {
  console.log("========================================================================");
  console.log("          Live Model Repair Evaluation (No Reference Leaks)            ");
  console.log("========================================================================");
  console.log(`Provider URL: ${process.env.LLM_API_URL}`);
  console.log(`Model: ${process.env.LLM_MODEL}`);
  console.log(`API Key set: ${!!process.env.LLM_API_KEY && process.env.LLM_API_KEY.length > 0}`);

  const evalsPath = path.join(WORKSPACE_ROOT, "data", "evals", "repair-cases.json");
  const cases = JSON.parse(fs.readFileSync(evalsPath, "utf-8"));

  const results: any[] = [];
  const outDir = path.join(ARTIFACTS_DIR, "system-testing", "live-model-eval-2026-10-09");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const bCase of cases) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`[EVAL] Case: ${bCase.id} - "${bCase.title}"`);
    console.log(`------------------------------------------------------------------------`);

    // Register temporary case
    const tempCase: BugCase = {
      id: bCase.id,
      title: bCase.title,
      description: bCase.description,
      status: "READY_TO_REPRODUCE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reproduction: {
        preconditions: [],
        steps: ["Run reproduction test"],
        expected: "All assertions pass",
        actual: "Defect observed",
        testFile: bCase.reproductionTest,
        lastRun: null,
      },
      patch: null,
      verification: null,
      evidence: [],
      rootCauseExplanation: null,
    };
    writeCase(tempCase);

    const t0 = Date.now();
    try {
      console.log(`[1] Starting repair run with live LLM (seeding defect in isolated workspace)...`);
      const run = await createAndStartRepairRun(bCase.id, {
        mode: "dynamic",
        maxAttempts: 2,
        seedDefects: [
          {
            relativePath: bCase.defect.relativePath,
            originalSnippet: bCase.defect.fixedContent,
            defectiveSnippet: bCase.defect.buggyContent,
          },
        ],
      });

      console.log(`    State: ${run.state}, Baseline: ${run.baselineRun?.outcome}`);
      if (run.proposal) {
        console.log(`    Model Proposal ID: ${run.proposal.proposalId}`);
        console.log(`    Diagnosis: ${run.proposal.diagnosis}`);
        console.log(`    Edits: ${JSON.stringify(run.proposal.edits, null, 2)}`);
      }

      if (run.state === "AWAITING_REVIEW" && run.proposal) {
        console.log(`[2] Approving genuine model proposal with exact hash binding...`);
        const finalized = await reviewAndApplyRepairRun(run.runId, {
          proposalId: run.proposal.proposalId,
          proposalHash: run.proposal.proposalHash,
          decision: "APPROVED",
        });

        const durationMs = Date.now() - t0;
        const allChecks = finalized.requiredChecks.every((c) => c.passed);
        console.log(`    Final State: ${finalized.state}, All Checks Passed: ${allChecks}`);

        results.push({
          caseId: bCase.id,
          title: bCase.title,
          split: bCase.split,
          state: finalized.state,
          verified: finalized.state === "VERIFIED",
          attempts: finalized.attempt,
          proposal: finalized.proposal,
          checks: finalized.requiredChecks,
          durationMs,
        });
      } else {
        results.push({
          caseId: bCase.id,
          title: bCase.title,
          split: bCase.split,
          state: run.state,
          verified: false,
          stopReason: run.stopReason,
          durationMs: Date.now() - t0,
        });
      }
    } catch (err: any) {
      console.error(`    Error: ${err.message}`);
      results.push({
        caseId: bCase.id,
        title: bCase.title,
        split: bCase.split,
        state: "ERROR",
        verified: false,
        error: err.message,
        durationMs: Date.now() - t0,
      });
    }
  }

  const summary = {
    total: results.length,
    verified: results.filter((r) => r.verified).length,
    results,
  };

  const reportPath = path.join(outDir, "live-model-evaluation-results.json");
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), "utf-8");

  console.log("\n========================================================================");
  console.log(` Live Model Evaluation Complete: ${summary.verified}/${summary.total} Cases Verified`);
  console.log(` Report saved to: ${reportPath}`);
  console.log("========================================================================");
}

main().catch((err) => {
  console.error("Live evaluation failed:", err);
  process.exit(1);
});
