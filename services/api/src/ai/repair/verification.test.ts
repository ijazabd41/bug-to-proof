import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { validateVerificationGates } from "./verification";
import { testFingerprint, digest } from "../../runner/integrity";
import type { TestRun } from "@bug-to-proof/shared-types";
import type { RequiredCheckResult } from "./contracts";
import { computeProposalHash } from "./contracts";

describe("Dynamic AI Repair Verification Gates (Negative & Boundary Tests)", () => {
  const caseId = "case-001";
  const reproductionTestFile = "tests/playwright/cases/case-001-cart-total.spec.ts";
  const validFp = testFingerprint(reproductionTestFile);
  const validReporterIdentity =
    "tests/playwright/cases/case-001-cart-total.spec.ts:cart total should equal sum of all item prices:chromium";

  let tempDir: string;
  let baselineArtifactDir: string;
  let postPatchArtifactDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "btp-gate-test-"));
    baselineArtifactDir = path.join(tempDir, "baseline");
    postPatchArtifactDir = path.join(tempDir, "verification");
    fs.mkdirSync(baselineArtifactDir, { recursive: true });
    fs.mkdirSync(postPatchArtifactDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {}
    }
  });

  function createSamplePlaywrightReport(outcome: "ASSERTION_FAILED" | "PASSED", specFile: string, title: string) {
    const isAssertion = outcome === "ASSERTION_FAILED";
    const attachmentBody = isAssertion
      ? Buffer.from(JSON.stringify({ expected: "$30.00", actual: "$10.00" })).toString("base64")
      : undefined;

    return {
      stats: {
        expected: isAssertion ? 0 : 1,
        unexpected: isAssertion ? 1 : 0,
        flaky: 0,
        skipped: 0,
      },
      errors: [],
      suites: [
        {
          title: "MiniShop Cart",
          file: specFile,
          specs: [
            {
              title,
              file: specFile,
              tests: [
                {
                  projectName: "chromium",
                  expectedStatus: "passed",
                  status: isAssertion ? "unexpected" : "expected",
                  results: [
                    {
                      workerIndex: 0,
                      status: isAssertion ? "failed" : "passed",
                      duration: 120,
                      error: isAssertion
                        ? {
                            message: "BTP_ASSERTION: Expected: $30.00, Received: $10.00",
                          }
                        : undefined,
                      attachments: isAssertion
                        ? [
                            {
                              name: "btp-assertion",
                              contentType: "application/json",
                              body: attachmentBody,
                            },
                          ]
                        : [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const validBaseline: TestRun = {
    runId: "run-base-1",
    runAt: new Date().toISOString(),
    passed: false,
    durationMs: 120,
    outcome: "ASSERTION_FAILED",
    expected: "$30.00",
    actual: "$10.00",
    reportHash: "sha256-baseline-report-hash",
    testFingerprint: validFp,
    testIds: [validReporterIdentity],
    evidenceIds: [],
  };

  const validPostPatch: TestRun = {
    runId: "run-post-1",
    runAt: new Date().toISOString(),
    passed: true,
    durationMs: 130,
    outcome: "PASSED",
    expected: "$30.00",
    actual: "$30.00",
    reportHash: "sha256-post-report-hash",
    testFingerprint: validFp,
    testIds: [validReporterIdentity],
    evidenceIds: [],
  };

  const validChecks: RequiredCheckResult[] = [
    {
      checkId: "check-typecheck",
      name: "TypeScript compilation",
      type: "typecheck",
      command: "tsc --noEmit",
      passed: true,
      exitCode: 0,
      durationMs: 200,
      output: "0 errors",
    },
    {
      checkId: "check-build",
      name: "Production Vite build",
      type: "build",
      command: "vite build",
      passed: true,
      exitCode: 0,
      durationMs: 300,
      output: "built in 0.3s",
    },
    {
      checkId: "check-unit-tests",
      name: "MiniShop unit tests",
      type: "unit-tests",
      command: "vitest run apps/minishop",
      passed: true,
      exitCode: 0,
      durationMs: 150,
      output: "3 passed",
    },
  ];

  it("passes when all verification gates are fully satisfied with valid reporter identities", () => {
    const result = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      mode: "simulated",
    });

    expect(result.verified).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("rejects when baseline reproduction is missing or was an environment failure", () => {
    const missingResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: null,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(missingResult.verified).toBe(false);
    expect(missingResult.violations).toContain("Missing baseline reproduction run record");

    const envFailResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, outcome: "INFRASTRUCTURE_ERROR" },
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(envFailResult.verified).toBe(false);
    expect(envFailResult.violations.some((v) => v.includes("expected 'ASSERTION_FAILED'"))).toBe(true);
  });

  it("rejects when baseline report hash or test fingerprint is missing/empty", () => {
    const tamperedResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: "" },
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(tamperedResult.verified).toBe(false);
    expect(tamperedResult.violations).toContain("Baseline report hash is missing or empty");
  });

  it("rejects when reproduction test fingerprint changed between baseline and post-patch", () => {
    const changedFpResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: { ...validPostPatch, testFingerprint: "tampered-fp-value" },
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(changedFpResult.verified).toBe(false);
    expect(changedFpResult.violations.some((v) => v.includes("does not match current disk test"))).toBe(true);
  });

  it("rejects when executed test identities do not match or do not correspond to reproduction spec", () => {
    // Mismatched before/after test identities
    const mismatchIdsResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, testIds: [validReporterIdentity] },
      postPatchRun: {
        ...validPostPatch,
        testIds: ["tests/playwright/cases/case-001-cart-total.spec.ts:different title:chromium"],
      },
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(mismatchIdsResult.verified).toBe(false);
    expect(mismatchIdsResult.violations.some((v) => v.includes("Executed test identities mismatch"))).toBe(true);

    // Test identity from a different spec file (e.g. case-002 instead of case-001)
    const wrongSpecResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: {
        ...validBaseline,
        testIds: ["tests/playwright/cases/case-002-repeated-item-qty.spec.ts:repeated qty test:chromium"],
      },
      postPatchRun: {
        ...validPostPatch,
        testIds: ["tests/playwright/cases/case-002-repeated-item-qty.spec.ts:repeated qty test:chromium"],
      },
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(wrongSpecResult.verified).toBe(false);
    expect(
      wrongSpecResult.violations.some((v) =>
        v.includes("does not correspond to configured reproduction spec")
      )
    ).toBe(true);

    // Empty test identities list
    const emptyIdsResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, testIds: [] },
      postPatchRun: { ...validPostPatch, testIds: [] },
      requiredChecks: validChecks,
      mode: "simulated",
    });
    expect(emptyIdsResult.verified).toBe(false);
    expect(emptyIdsResult.violations.some((v) => v.includes("executed test identities list is empty"))).toBe(true);
  });

  it("validates saved disk evidence and rejects fabricated report hashes or tampered reports", () => {
    const baseReport = createSamplePlaywrightReport(
      "ASSERTION_FAILED",
      "tests/playwright/cases/case-001-cart-total.spec.ts",
      "cart total should equal sum of all item prices"
    );
    const baseReportStr = JSON.stringify(baseReport, null, 2);
    const realBaseHash = digest(baseReportStr);

    fs.writeFileSync(path.join(baselineArtifactDir, "result.json"), baseReportStr);
    fs.writeFileSync(
      path.join(baselineArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "run-base-1",
        exitCode: 1,
        outcome: "ASSERTION_FAILED",
        reportHash: realBaseHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );

    const postReport = createSamplePlaywrightReport(
      "PASSED",
      "tests/playwright/cases/case-001-cart-total.spec.ts",
      "cart total should equal sum of all item prices"
    );
    const postReportStr = JSON.stringify(postReport, null, 2);
    const realPostHash = digest(postReportStr);

    fs.writeFileSync(path.join(postPatchArtifactDir, "result.json"), postReportStr);
    fs.writeFileSync(
      path.join(postPatchArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "run-post-1",
        exitCode: 0,
        outcome: "PASSED",
        passed: true,
        reportHash: realPostHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );

    // 1. Valid saved evidence matches perfectly
    const validDiskResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: realBaseHash },
      postPatchRun: { ...validPostPatch, reportHash: realPostHash },
      requiredChecks: validChecks,
      baselineArtifactDir,
      postPatchArtifactDir,
    });
    expect(validDiskResult.verified).toBe(true);
    expect(validDiskResult.violations).toHaveLength(0);

    // 2. Fabricated report hash (memory claims a hash not matching result.json)
    const fabricatedHashResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: "fabricated-hash-12345" },
      postPatchRun: { ...validPostPatch, reportHash: realPostHash },
      requiredChecks: validChecks,
      baselineArtifactDir,
      postPatchArtifactDir,
    });
    expect(fabricatedHashResult.verified).toBe(false);
    expect(
      fabricatedHashResult.violations.some((v) => v.includes("Baseline report hash mismatch on disk"))
    ).toBe(true);

    // 3. Tampered result.json content after manifest written
    fs.writeFileSync(path.join(baselineArtifactDir, "result.json"), '{"tampered": true}');
    const tamperedReportResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: realBaseHash },
      postPatchRun: { ...validPostPatch, reportHash: realPostHash },
      requiredChecks: validChecks,
      baselineArtifactDir,
      postPatchArtifactDir,
    });
    expect(tamperedReportResult.verified).toBe(false);
    expect(
      tamperedReportResult.violations.some(
        (v) => v.includes("report hash mismatch on disk") || v.includes("digest does not match")
      )
    ).toBe(true);
  });

  it("rejects when any policy-required regression check is missing or failing", () => {
    // Missing build check
    const missingCheckResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks.filter((c) => c.type !== "build"),
    });
    expect(missingCheckResult.verified).toBe(false);
    expect(missingCheckResult.violations).toContain("Missing required regression check: 'build'");

    // Failing unit test check
    const failingCheckResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks.map((c) =>
        c.type === "unit-tests" ? { ...c, passed: false, exitCode: 1 } : c
      ),
    });
    expect(failingCheckResult.verified).toBe(false);
    expect(
      failingCheckResult.violations.some((v) => v.includes("MiniShop unit tests' failed with exit code 1"))
    ).toBe(true);
  });

  it("rejects swapped reports, stale manifests, wrong run IDs, and missing artifact logs", () => {
    const baseReport = createSamplePlaywrightReport(
      "ASSERTION_FAILED",
      "tests/playwright/cases/case-001-cart-total.spec.ts",
      "cart total should equal sum of all item prices"
    );
    const baseReportStr = JSON.stringify(baseReport, null, 2);
    const realBaseHash = digest(baseReportStr);

    const postReport = createSamplePlaywrightReport(
      "PASSED",
      "tests/playwright/cases/case-001-cart-total.spec.ts",
      "cart total should equal sum of all item prices"
    );
    const postReportStr = JSON.stringify(postReport, null, 2);
    const realPostHash = digest(postReportStr);

    // Write swapped reports: post-patch report in baseline dir, baseline report in post-patch dir
    fs.writeFileSync(path.join(baselineArtifactDir, "result.json"), postReportStr);
    fs.writeFileSync(
      path.join(baselineArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "run-base-1",
        exitCode: 0,
        outcome: "PASSED",
        reportHash: realPostHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );

    fs.writeFileSync(path.join(postPatchArtifactDir, "result.json"), baseReportStr);
    fs.writeFileSync(
      path.join(postPatchArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "run-post-1",
        exitCode: 1,
        outcome: "ASSERTION_FAILED",
        reportHash: realBaseHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );

    const swappedResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: realPostHash },
      postPatchRun: { ...validPostPatch, reportHash: realBaseHash },
      requiredChecks: validChecks,
      baselineArtifactDir,
      postPatchArtifactDir,
    });
    expect(swappedResult.verified).toBe(false);
    expect(swappedResult.violations.some((v) => v.includes("expected 'ASSERTION_FAILED'"))).toBe(true);

    // Stale manifest with wrong runId
    fs.writeFileSync(path.join(baselineArtifactDir, "result.json"), baseReportStr);
    fs.writeFileSync(
      path.join(baselineArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "stale-old-run-id-999",
        exitCode: 1,
        outcome: "ASSERTION_FAILED",
        reportHash: realBaseHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );
    fs.writeFileSync(path.join(postPatchArtifactDir, "result.json"), postReportStr);
    fs.writeFileSync(
      path.join(postPatchArtifactDir, "manifest.json"),
      JSON.stringify({
        runId: "run-post-1",
        exitCode: 0,
        outcome: "PASSED",
        passed: true,
        reportHash: realPostHash,
        testFingerprint: validFp,
        testIds: [validReporterIdentity],
      })
    );

    const staleRunResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, runId: "run-base-1", reportHash: realBaseHash },
      postPatchRun: { ...validPostPatch, runId: "run-post-1", reportHash: realPostHash },
      requiredChecks: validChecks,
      baselineArtifactDir,
      postPatchArtifactDir,
    });
    expect(staleRunResult.verified).toBe(false);
    expect(staleRunResult.violations.some((v) => v.includes("manifest runId"))).toBe(true);

    // Missing check log file on disk
    const missingLogChecks: RequiredCheckResult[] = validChecks.map((c) => ({
      ...c,
      artifactPath: "artifacts/runs/non-existent-run/checks/missing.log",
    }));
    const missingLogResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: { ...validBaseline, reportHash: realBaseHash },
      postPatchRun: { ...validPostPatch, reportHash: realPostHash },
      requiredChecks: missingLogChecks,
    });
    expect(missingLogResult.verified).toBe(false);
    expect(missingLogResult.violations.some((v) => v.includes("Regression check log missing"))).toBe(true);
  });

  it("rejects verification when proposal content is tampered or review approval hash does not match", () => {
    const edits = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "a = 1",
        newContent: "a = 2",
      },
    ];
    const diagnosis = "Bug in cart store";
    const rationale = "Fix variable assignment";

    // 1. Tampered proposal (stored hash does not match recomputed hash)
    const tamperedProposal = {
      schemaVersion: "1.0" as const,
      proposalId: "prop-test-1",
      diagnosis,
      assumptions: [],
      rationale,
      edits,
      unifiedDiff: "--- diff",
      proposalHash: "0000000000000000000000000000000000000000000000000000000000000000", // Fake/tampered hash
      proposedAt: new Date().toISOString(),
    };

    const tamperedResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      proposal: tamperedProposal,
      mode: "simulated",
    });

    expect(tamperedResult.verified).toBe(false);
    expect(tamperedResult.violations.some((v) => v.includes("Proposal hash mismatch"))).toBe(true);

    // 2. Review approval binding mismatch
    const recomputedHash = computeProposalHash(edits, diagnosis, rationale);
    const validProposal = {
      ...tamperedProposal,
      proposalHash: recomputedHash,
    };

    const mismatchedReview = {
      reviewId: "rev-1",
      proposalId: "prop-test-1",
      proposalHash: "different-hash-that-was-not-approved",
      decision: "APPROVED" as const,
      reviewedAt: new Date().toISOString(),
    };

    const reviewMismatchResult = validateVerificationGates({
      caseId,
      reproductionTestFile,
      testFingerprint: validFp,
      baselineRun: validBaseline,
      postPatchRun: validPostPatch,
      requiredChecks: validChecks,
      proposal: validProposal,
      review: mismatchedReview,
      mode: "simulated",
    });

    expect(reviewMismatchResult.verified).toBe(false);
    expect(reviewMismatchResult.violations.some((v) => v.includes("Review proposal hash"))).toBe(true);
  });
});

