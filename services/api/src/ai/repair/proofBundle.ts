import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { ARTIFACTS_DIR } from "../../utils/paths";
import { getRunRecord } from "./runStore";
import { testFingerprint } from "../../runner/integrity";
import { generatedTestFingerprint } from "../../runner/playwrightRunner";
import {
  createZipArchive,
  validateZipPath,
  ZipEntry,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_SIZE,
  MAX_ZIP_TOTAL_UNCOMPRESSED,
  OversizedArchiveError,
} from "../../utils/zip";
import type { RepairRunRecord, RepairRunState } from "./contracts";
import { validateVerificationGates } from "./verification";

export interface BundleFileEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
  description: string;
}

export interface ProofManifest {
  schemaVersion: "1.0";
  bundleVersion: "1.0";
  runId: string;
  caseId: string;
  mode: "dynamic" | "simulated";
  state: RepairRunState;
  verified: boolean;
  verificationViolations?: string[];
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  completedAt?: string;
  exportedAt: string;
  originalSourceFingerprint: string;
  testFingerprint: string;
  testFingerprintMatched: boolean;
  reproductionTestFile: string;
  reproductionTestRoot?: string;
  reproductionProvenance?: NonNullable<NonNullable<RepairRunRecord["inputs"]>["reproductionTest"]>["provenance"];
  proposalId?: string;
  proposalHash?: string;
  reviewDecision?: "APPROVED" | "REJECTED";
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  costEstimate?: {
    estimatedCost?: number;
    currency?: string;
    pricingDate?: string;
  };
  files: BundleFileEntry[];
}

export interface ProofBundleResult {
  buffer: Buffer;
  manifest: ProofManifest;
  filename: string;
}

export function sha256(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Enforces containment of a disk artifact path within an allowed root directory.
 * Resolves real paths to prevent symlink and junction escape.
 * Rejects forbidden sensitive files (.env, credentials, secrets, node_modules, .git).
 */
export function validateArtifactContainment(filePath: string, allowedRoot: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid artifact path: empty path");
  }
  if (filePath.includes("\0")) {
    throw new Error("Invalid artifact path: null byte detected");
  }

  const normalizedRoot = path.resolve(allowedRoot);
  // Treat both separator styles as path syntax regardless of the runner OS.
  // Otherwise `..\\..\\secret.env` is a harmless filename on POSIX and can
  // bypass a containment check that will reject the same input on Windows.
  const portableFilePath = filePath.replace(/[\\/]+/g, path.sep);
  const resolved = path.resolve(allowedRoot, portableFilePath);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error(`Path traversal escape rejected: '${filePath}' escapes allowed root '${allowedRoot}'`);
  }

  if (fs.existsSync(resolved)) {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(normalizedRoot + path.sep) && real !== normalizedRoot) {
      throw new Error(`Symlink or junction escape rejected: '${filePath}' resolves to '${real}'`);
    }

    const base = path.basename(real).toLowerCase();
    if (
      base.startsWith(".env") ||
      base.includes("credential") ||
      base.includes("secret") ||
      base.includes("token") ||
      base.includes("password") ||
      real.includes("node_modules") ||
      real.includes(".git")
    ) {
      throw new Error(`Access to forbidden sensitive path rejected: '${real}'`);
    }
  }

  return resolved;
}

/**
 * Builds an immutable, self-contained, cryptographically hashed Proof Bundle ZIP archive for a repair run.
 */
export async function buildProofBundle(runId: string): Promise<ProofBundleResult> {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) {
    throw new Error("Invalid run ID format");
  }

  const run: RepairRunRecord | null = getRunRecord(runId);
  if (!run) {
    throw new Error(`Repair run not found: ${runId}`);
  }

  const entries: ZipEntry[] = [];
  const manifestFiles: BundleFileEntry[] = [];
  const verificationViolations: string[] = [];
  const seenZipPaths = new Set<string>();
  let totalUncompressedBytes = 0;

  const addFile = (zipPath: string, content: Buffer | string, description: string) => {
    const cleanPath = validateZipPath(zipPath);
    if (seenZipPaths.has(cleanPath)) {
      throw new Error(`Duplicate ZIP entry: ${cleanPath}`);
    }

    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");

    if (entries.length + 1 > MAX_ZIP_ENTRIES) {
      throw new OversizedArchiveError(
        `Archive exceeds maximum allowed entries limit (${entries.length + 1} > ${MAX_ZIP_ENTRIES})`
      );
    }
    if (buf.length > MAX_ZIP_ENTRY_SIZE) {
      throw new OversizedArchiveError(
        `File '${cleanPath}' size (${buf.length} bytes) exceeds per-file limit of ${MAX_ZIP_ENTRY_SIZE} bytes`
      );
    }
    if (totalUncompressedBytes + buf.length > MAX_ZIP_TOTAL_UNCOMPRESSED) {
      throw new OversizedArchiveError(
        `Total uncompressed payload size (${totalUncompressedBytes + buf.length} bytes) exceeds limit of ${MAX_ZIP_TOTAL_UNCOMPRESSED} bytes`
      );
    }

    seenZipPaths.add(cleanPath);
    totalUncompressedBytes += buf.length;
    const hash = sha256(buf);

    entries.push({ path: cleanPath, data: buf });
    manifestFiles.push({
      path: cleanPath,
      sizeBytes: buf.length,
      sha256: hash,
      description,
    });
  };

  // 1. Immutable Bug Case Snapshot captured at run creation
  let caseSnapshot: Record<string, unknown>;
  if (run.inputs?.caseSnapshot) {
    caseSnapshot = run.inputs.caseSnapshot;
    addFile(
      "case-snapshot.json",
      JSON.stringify(caseSnapshot, null, 2),
      "Immutable snapshot of the bug case definition at run creation"
    );
  } else {
    caseSnapshot = {
      status: "UNAVAILABLE",
      caseId: run.caseId,
      message: "Historical bug report snapshot was not captured at run creation",
    };
    addFile(
      "case-snapshot.json",
      JSON.stringify(caseSnapshot, null, 2),
      "Historical bug report snapshot (unavailable for this legacy run)"
    );
    verificationViolations.push("Immutable bug report snapshot was not captured at run creation");
  }

  // 2. Exact Reproduction Test captured at run creation & Fingerprint Verification
  let testMatched = false;
  let currentDiskFp = "";
  try {
    currentDiskFp = run.reproductionTestRoot ? generatedTestFingerprint(run.reproductionTestFile) : testFingerprint(run.reproductionTestFile);
  } catch {}

  if (run.inputs?.reproductionTest) {
    const testContent = run.inputs.reproductionTest.content;
    const testFp = run.inputs.reproductionTest.fingerprint;
    const testFileName = path.basename(run.inputs.reproductionTest.filePath) || "reproduction.spec.ts";

    testMatched = testFp === run.testFingerprint && currentDiskFp === run.testFingerprint;
    if (!testMatched) {
      verificationViolations.push(
        `Reproduction test fingerprint mismatch: captured ${testFp} vs recorded ${run.testFingerprint} vs disk ${currentDiskFp}`
      );
    }

    addFile(
      `reproduction/${testFileName}`,
      testContent,
      `Exact Playwright reproduction spec captured at run creation (fingerprint: ${testFp})`
    );
  } else {
    addFile(
      "reproduction/spec-unavailable.txt",
      `// Historical reproduction test snapshot was not captured for run ${run.runId}`,
      "Historical reproduction test content unavailable"
    );
    verificationViolations.push("Immutable reproduction test content was not captured at run creation");
  }

  // 3. Raw Run Record
  addFile(
    "run.json",
    JSON.stringify(run, null, 2),
    "Full serialized repair run record"
  );

  // 4. Approved Baseline Reproduction Evidence
  if (run.baselineRun) {
    addFile(
      "baseline/result.json",
      JSON.stringify(run.baselineRun, null, 2),
      "Baseline reproduction execution result"
    );
  }

  const runDiskDir = path.join(ARTIFACTS_DIR, "runs", runId);
  const baselineDiskDir = path.join(runDiskDir, "baseline");

  if (fs.existsSync(baselineDiskDir)) {
    collectDirectoryArtifacts(baselineDiskDir, baselineDiskDir, "baseline", addFile);
  }

  // 5. Model Proposal, Unified Diff, & Review Decision
  if (run.proposal) {
    addFile(
      "proposal/proposal.json",
      JSON.stringify(run.proposal, null, 2),
      "Model repair proposal with diagnosis and rationale"
    );
    if (run.proposal.unifiedDiff) {
      addFile(
        "proposal/patch.diff",
        run.proposal.unifiedDiff,
        "Unified patch diff proposed for the defect"
      );
    }
  }
  if (run.review) {
    addFile(
      "proposal/review.json",
      JSON.stringify(run.review, null, 2),
      "Proposal review record with cryptographic approval binding"
    );
  }

  // 6. Post-Patch Verification Evidence
  if (run.postPatchRun) {
    addFile(
      "verification/result.json",
      JSON.stringify(run.postPatchRun, null, 2),
      "Post-patch reproduction verification test result"
    );
  }

  const attemptNum = run.attempt || 1;
  const verificationDiskDir = path.join(runDiskDir, `attempt-${attemptNum}`, "verification");
  if (fs.existsSync(verificationDiskDir)) {
    collectDirectoryArtifacts(verificationDiskDir, verificationDiskDir, "verification", addFile);
  }

  // 7. Required Regression Checks & Logs
  if (run.requiredChecks && run.requiredChecks.length > 0) {
    addFile(
      "checks/results.json",
      JSON.stringify(run.requiredChecks, null, 2),
      "Required regression check suite results"
    );
  }

  const checksDiskDir = path.join(runDiskDir, `attempt-${attemptNum}`, "checks");
  if (fs.existsSync(checksDiskDir)) {
    collectDirectoryArtifacts(checksDiskDir, checksDiskDir, "checks/logs", addFile);
  }

  // 8. Strict Verification Status Assessment using Centralized Verification Gates
  const gateResult = validateVerificationGates({
    caseId: run.caseId,
    reproductionTestFile: run.reproductionTestFile,
    reproductionTestRoot: run.reproductionTestRoot,
    testFingerprint: run.testFingerprint,
    baselineRun: run.baselineRun,
    postPatchRun: run.postPatchRun,
    requiredChecks: run.requiredChecks || [],
    proposal: run.proposal,
    review: run.review,
    baselineArtifactDir: fs.existsSync(baselineDiskDir) ? baselineDiskDir : undefined,
    postPatchArtifactDir: fs.existsSync(verificationDiskDir) ? verificationDiskDir : undefined,
    mode: run.mode,
  });

  if (!gateResult.verified) {
    for (const v of gateResult.violations) {
      if (!verificationViolations.includes(v)) {
        verificationViolations.push(v);
      }
    }
  }

  if (run.state !== "VERIFIED") {
    verificationViolations.push(`Run terminated with state '${run.state}' (not 'VERIFIED')`);
  }

  const isStrictlyVerified = run.state === "VERIFIED" && verificationViolations.length === 0;

  // 9. Generate Human-Readable Markdown Report (proof-report.md)
  const reportMarkdown = generateMarkdownReport({
    run,
    caseSnapshot,
    isStrictlyVerified,
    verificationViolations,
    testMatched,
    testRelPath: run.reproductionTestFile,
  });

  addFile(
    "proof-report.md",
    reportMarkdown,
    "Comprehensive verification proof report in GitHub-flavored Markdown"
  );

  // 10. Generate Final Versioned Manifest (manifest.json)
  const manifest: ProofManifest = {
    schemaVersion: "1.0",
    bundleVersion: "1.0",
    runId: run.runId,
    caseId: run.caseId,
    mode: run.mode,
    state: run.state,
    verified: isStrictlyVerified,
    verificationViolations: verificationViolations.length > 0 ? verificationViolations : undefined,
    attempt: run.attempt,
    maxAttempts: run.maxAttempts,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    exportedAt: new Date().toISOString(),
    originalSourceFingerprint: run.originalSourceFingerprint,
    testFingerprint: run.testFingerprint,
    testFingerprintMatched: testMatched,
    reproductionTestFile: run.reproductionTestFile,
    reproductionTestRoot: run.reproductionTestRoot,
    reproductionProvenance: run.inputs?.reproductionTest.provenance,
    proposalId: run.proposal?.proposalId,
    proposalHash: run.proposal?.proposalHash,
    reviewDecision: run.review?.decision,
    tokenUsage: run.attempts?.[(run.attempt || 1) - 1]?.tokenUsage,
    costEstimate: run.costEstimate,
    files: manifestFiles,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBuf = Buffer.from(manifestJson, "utf-8");

  // Insert manifest at beginning of zip entries (without circular self-hash)
  entries.unshift({ path: "manifest.json", data: manifestBuf });

  // 11. Create ZIP Archive Buffer
  const zipBuffer = createZipArchive(entries);
  const filename = `proof-bundle-${run.caseId}-${run.runId}.zip`;

  return {
    buffer: zipBuffer,
    manifest,
    filename,
  };
}

const APPROVED_EVIDENCE_EXTENSIONS = new Set([
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".zip",
  ".md",
  ".txt",
  ".log",
]);

function isApprovedEvidenceFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (
    lower.startsWith(".env") ||
    lower.includes("credential") ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("password") ||
    lower.includes("apikey") ||
    lower.includes("api_key") ||
    lower.endsWith(".lock") ||
    lower.endsWith(".tmp") ||
    lower.endsWith(".exe") ||
    lower.endsWith(".bat") ||
    lower.endsWith(".cmd") ||
    lower.startsWith(".git") ||
    lower === "node_modules"
  ) {
    return false;
  }
  const ext = path.extname(lower);
  return APPROVED_EVIDENCE_EXTENSIONS.has(ext);
}

/**
 * Recursively collects evidence artifacts from an approved directory, applying containment validation
 * and narrow allowlist filtering.
 */
function collectDirectoryArtifacts(
  currentDir: string,
  baseDir: string,
  zipPrefix: string,
  addFile: (zipPath: string, content: Buffer, description: string) => void
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(currentDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git" || ent.name.startsWith(".tmp")) {
        continue;
      }
      collectDirectoryArtifacts(fullPath, baseDir, zipPrefix, addFile);
    } else if (ent.isFile()) {
      if (ent.name === "result.json") {
        // already added explicitly at root of phase
        continue;
      }
      if (!isApprovedEvidenceFile(ent.name)) {
        continue;
      }

      // Enforce containment
      validateArtifactContainment(fullPath, baseDir);

      // Pre-read size limit check before allocation
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_ZIP_ENTRY_SIZE) {
        throw new OversizedArchiveError(
          `Evidence file '${ent.name}' size (${stat.size} bytes) exceeds per-file limit of ${MAX_ZIP_ENTRY_SIZE} bytes`
        );
      }

      const content = fs.readFileSync(fullPath);
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const zipPath = `${zipPrefix}/${rel}`.replace(/\/+/g, "/");
      addFile(zipPath, content, `Evidence artifact: ${rel}`);
    }
  }
}

function generateMarkdownReport(opts: {
  run: RepairRunRecord;
  caseSnapshot: Record<string, unknown>;
  isStrictlyVerified: boolean;
  verificationViolations: string[];
  testMatched: boolean;
  testRelPath: string;
}): string {
  const { run, caseSnapshot, isStrictlyVerified, verificationViolations, testMatched, testRelPath } = opts;

  const title = (caseSnapshot.title as string) || run.caseId;
  const statusBadge = isStrictlyVerified ? "**PASSED (VERIFIED)**" : `**NOT VERIFIED (${run.state})**`;

  let md = `# Verification Proof Report: ${run.caseId}\n\n`;
  md += `**Case Title**: ${title}  \n`;
  md += `**Run ID**: \`${run.runId}\`  \n`;
  md += `**Execution Mode**: \`${run.mode}\`  \n`;
  md += `**Verification Status**: ${statusBadge}  \n`;
  md += `**Attempts**: ${run.attempt} of ${run.maxAttempts}  \n`;
  md += `**Created At**: ${run.createdAt}  \n`;
  if (run.completedAt) {
    md += `**Completed At**: ${run.completedAt}  \n`;
  }
  md += `\n---\n\n`;

  // Verification Summary & Integrity Gates
  md += `## 1. Verification Integrity Summary\n\n`;
  if (isStrictlyVerified) {
    md += `> [!NOTE]\n> All cryptographic hashes, approval bindings, baseline reproduction failures, and post-patch regression gates have been verified.\n\n`;
  } else {
    md += `> [!WARNING]\n> This run is not verified as a complete proof. The following conditions were noted:\n`;
    for (const v of verificationViolations) {
      md += `> - ${v}\n`;
    }
    md += `\n`;
  }

  // Reproduction Test
  md += `## 2. Reproduction Test Specification\n\n`;
  md += `- **Test File**: \`${testRelPath}\`\n`;
  md += `- **Test Fingerprint**: \`${run.testFingerprint}\`\n`;
  md += `- **Fingerprint Intact**: ${testMatched ? "Yes" : "Mismatch / Missing"}\n\n`;

  // Baseline vs Verification Outcomes
  md += `## 3. Evidence-Backed Execution Results\n\n`;
  md += `| Phase | Expected Outcome | Actual Outcome | Duration | Status |\n`;
  md += `|---|---|---|---|---|\n`;
  md += `| Baseline Reproduction | \`ASSERTION_FAILED\` | \`${run.baselineRun?.outcome || "NOT RUN"}\` | ${run.baselineRun?.durationMs ?? "-"} ms | ${run.baselineRun ? (run.baselineRun.passed ? "PASSED" : "FAILED") : "-"} |\n`;
  md += `| Post-Patch Verification | \`PASSED\` | \`${run.postPatchRun?.outcome || "NOT RUN"}\` | ${run.postPatchRun?.durationMs ?? "-"} ms | ${run.postPatchRun ? (run.postPatchRun.passed ? "PASSED" : "FAILED") : "-"} |\n\n`;

  if (run.baselineRun?.actual) {
    md += `### Baseline Failure Diagnostic\n\`\`\`\n${run.baselineRun.actual}\n\`\`\`\n\n`;
  }

  // Diagnosis and Applied Patch
  md += `## 4. Diagnosis & Applied Patch\n\n`;
  if (run.proposal) {
    md += `**Proposal ID**: \`${run.proposal.proposalId}\`  \n`;
    md += `**Proposal SHA-256**: \`${run.proposal.proposalHash}\`  \n`;
    md += `**Review Decision**: \`${run.review?.decision || "NONE"}\`  \n\n`;
    md += `### Root Cause Diagnosis\n${run.proposal.diagnosis}\n\n`;
    if (run.proposal.rationale) {
      md += `### Rationale\n${run.proposal.rationale}\n\n`;
    }
    if (run.proposal.assumptions && run.proposal.assumptions.length > 0) {
      md += `### Assumptions\n`;
      for (const a of run.proposal.assumptions) {
        md += `- ${a}\n`;
      }
      md += `\n`;
    }
    if (run.proposal.unifiedDiff) {
      md += `### Unified Diff\n\`\`\`diff\n${run.proposal.unifiedDiff}\n\`\`\`\n\n`;
    }
  } else {
    md += `*No repair proposal was generated for this run.*\n\n`;
  }

  // Regression Checks
  md += `## 5. Required Regression Check Suite\n\n`;
  if (run.requiredChecks && run.requiredChecks.length > 0) {
    md += `| Check Name | Type | Status | Exit Code | Duration |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const c of run.requiredChecks) {
      const icon = c.passed ? "PASS" : "FAIL";
      md += `| ${c.name} | \`${c.type}\` | ${icon} | ${c.exitCode ?? "-"} | ${c.durationMs} ms |\n`;
    }
    md += `\n`;
  } else {
    md += `*No regression checks were executed.*\n\n`;
  }

  // Token Usage & Cost (Honest reporting)
  md += `## 6. Resource Usage & Pricing\n\n`;
  const attemptRecord = run.attempts?.[(run.attempt || 1) - 1];
  if (attemptRecord?.tokenUsage) {
    md += `- **Prompt Tokens**: ${attemptRecord.tokenUsage.promptTokens ?? "N/A"}\n`;
    md += `- **Completion Tokens**: ${attemptRecord.tokenUsage.completionTokens ?? "N/A"}\n`;
    md += `- **Total Tokens**: ${attemptRecord.tokenUsage.totalTokens ?? "N/A"}\n`;
  } else {
    md += `- **Token Usage**: Not recorded or simulated mode\n`;
  }

  if (run.costEstimate?.estimatedCost !== undefined) {
    md += `- **Estimated Cost**: ${run.costEstimate.currency ?? "$"}${run.costEstimate.estimatedCost.toFixed(4)} (pricing as of ${run.costEstimate.pricingDate ?? "current"})\n`;
  } else {
    md += `- **Cost Estimate**: Explicit pricing configuration was unavailable\n`;
  }
  md += `\n`;

  // Limitations and Assumptions
  md += `## 7. Assumptions and Limitations\n\n`;
  md += `1. **Local Demonstration Scope**: All verification occurs strictly in isolated snapshot workspaces on the local environment.\n`;
  md += `2. **Non-destructive Evidence**: Candidate workspace files and pristine backups are preserved during verification.\n`;
  md += `3. **Evidence Integrity**: All results are generated by genuine test runner executions and cryptographically hashed.\n\n`;

  return md;
}
