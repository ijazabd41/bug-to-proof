import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { buildProofBundle, validateArtifactContainment, sha256 } from "./proofBundle";
import { saveRunRecord } from "./runStore";
import { writeCase, readCase } from "../../storage/caseStore";
import { ARTIFACTS_DIR, WORKSPACE_ROOT } from "../../utils/paths";
import type { RepairRunRecord, RunInputs } from "./contracts";
import { computeProposalHash } from "./contracts";
import { testFingerprint, digest } from "../../runner/integrity";
import { extractZipArchive, OversizedArchiveError, createZipArchive, MAX_ZIP_ENTRY_SIZE } from "../../utils/zip";

describe("Proof Bundle Exporter & Secure Artifact Archive", () => {
  const createdDirs: string[] = [];

  function getUniqueRunDir(): { testRunId: string; runDir: string } {
    const testRunId = `test-bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runDir = path.join(ARTIFACTS_DIR, "runs", testRunId);
    fs.mkdirSync(runDir, { recursive: true });
    createdDirs.push(runDir);
    return { testRunId, runDir };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of createdDirs) {
      if (fs.existsSync(d)) {
        try {
          fs.rmSync(d, { recursive: true, force: true });
        } catch {}
      }
    }
    createdDirs.length = 0;
  });

  function createValidFixtures(testRunId: string, runDir: string) {
    const testCaseId = "case-001";
    const testSpecRelPath = "tests/playwright/cases/case-001-cart-total.spec.ts";
    const fingerprint = testFingerprint(testSpecRelPath);
    const testSpecContent = fs.readFileSync(path.resolve(WORKSPACE_ROOT, testSpecRelPath), "utf-8");
    const testId = `${testSpecRelPath}:Cart Total:chromium`;

    const edits = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "clearCart: () => {}",
        newContent: "clearCart: () => set({ items: [] })",
      },
    ];
    const diagnosis = "Cart store total and clearCart state bug";
    const rationale = "Clear items on checkout";
    const validProposalHash = computeProposalHash(edits, diagnosis, rationale);

    const initialBugCase = {
      id: testCaseId,
      title: "Cart total defect snapshot",
      description: "Initial bug report",
      category: "cart",
      status: "OPEN",
      reproduction: { testFile: testSpecRelPath },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const inputs: RunInputs = {
      caseSnapshot: initialBugCase,
      reproductionTest: {
        filePath: testSpecRelPath,
        content: testSpecContent,
        fingerprint,
        provenance: { reproductionRunId: "generated-source-run", definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64),
          sourceFingerprint: "c".repeat(64), acceptedAt: "2026-10-14T00:00:00.000Z", acceptedBy: "reviewer" },
      },
    };

    // Create valid Playwright report structures on disk
    const baselineDir = path.join(runDir, "baseline");
    const verificationDir = path.join(runDir, "attempt-1", "verification");
    const checksDir = path.join(runDir, "attempt-1", "checks");

    fs.mkdirSync(baselineDir, { recursive: true });
    fs.mkdirSync(verificationDir, { recursive: true });
    fs.mkdirSync(checksDir, { recursive: true });

    const baselineReport = {
      config: { projects: [{ name: "chromium" }] },
      stats: { expected: 0, unexpected: 1 },
      errors: [],
      suites: [
        {
          title: "Cart Total",
          file: testSpecRelPath,
          specs: [
            {
              file: testSpecRelPath,
              title: "Cart Total",
              tests: [
                {
                  projectName: "chromium",
                  expectedStatus: "passed",
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      errors: [{ message: "BTP_ASSERTION: Expected: $30.00 Received: $10.00" }],
                      error: { message: "BTP_ASSERTION: Expected: $30.00 Received: $10.00" },
                      attachments: [
                        {
                          name: "btp-assertion",
                          contentType: "application/json",
                          body: Buffer.from(JSON.stringify({ expected: "$30.00", actual: "$10.00" })).toString("base64"),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const postPatchReport = {
      config: { projects: [{ name: "chromium" }] },
      stats: { expected: 1, unexpected: 0 },
      errors: [],
      suites: [
        {
          title: "Cart Total",
          file: testSpecRelPath,
          specs: [
            {
              file: testSpecRelPath,
              title: "Cart Total",
              tests: [
                {
                  projectName: "chromium",
                  expectedStatus: "passed",
                  status: "expected",
                  results: [{ status: "passed", errors: [] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const baselineResultJson = JSON.stringify(baselineReport, null, 2);
    const postPatchResultJson = JSON.stringify(postPatchReport, null, 2);

    fs.writeFileSync(path.join(baselineDir, "result.json"), baselineResultJson);
    fs.writeFileSync(path.join(verificationDir, "result.json"), postPatchResultJson);

    const baselineReportHash = digest(baselineResultJson);
    const postPatchReportHash = digest(postPatchResultJson);

    const baselineManifest = {
      runId: "base-run-1",
      caseId: testCaseId,
      phase: "before",
      outcome: "ASSERTION_FAILED",
      passed: false,
      reportHash: baselineReportHash,
      testFingerprint: fingerprint,
      testIds: [testId],
      exitCode: 1,
    };

    const postPatchManifest = {
      runId: "post-run-1",
      caseId: testCaseId,
      phase: "after",
      outcome: "PASSED",
      passed: true,
      reportHash: postPatchReportHash,
      testFingerprint: fingerprint,
      testIds: [testId],
      exitCode: 0,
    };

    fs.writeFileSync(path.join(baselineDir, "manifest.json"), JSON.stringify(baselineManifest, null, 2));
    fs.writeFileSync(path.join(verificationDir, "manifest.json"), JSON.stringify(postPatchManifest, null, 2));
    fs.writeFileSync(path.join(baselineDir, "screenshot.png"), Buffer.from("genuine-baseline-screenshot"));
    fs.writeFileSync(path.join(checksDir, "typecheck.log"), "Found 0 errors.");

    const verifiedRecord: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: testCaseId,
      mode: "dynamic",
      state: "VERIFIED",
      attempt: 1,
      maxAttempts: 3,
      inputs,
      originalSourceFingerprint: "abc123source",
      targetSnapshotDir: runDir,
      testFingerprint: fingerprint,
      reproductionTestFile: testSpecRelPath,
      baselineRun: {
        runId: "base-run-1",
        runAt: new Date().toISOString(),
        outcome: "ASSERTION_FAILED",
        passed: false,
        durationMs: 1200,
        expected: "Cart total displays $30.00",
        actual: "Expected: $30.00, Received: $10.00",
        testIds: [testId],
        evidenceIds: [],
        reportHash: baselineReportHash,
        testFingerprint: fingerprint,
      },
      proposal: {
        schemaVersion: "1.0",
        proposalId: "prop-1",
        diagnosis,
        assumptions: ["MiniShop Zustand store items array"],
        rationale,
        edits,
        unifiedDiff: "- clearCart: () => {}\n+ clearCart: () => set({ items: [] })",
        proposalHash: validProposalHash,
        proposedAt: new Date().toISOString(),
      },
      review: {
        reviewId: "rev-1",
        proposalId: "prop-1",
        proposalHash: validProposalHash,
        decision: "APPROVED",
        reviewedAt: new Date().toISOString(),
        reviewerNotes: "Approved verified patch",
      },
      postPatchRun: {
        runId: "post-run-1",
        runAt: new Date().toISOString(),
        outcome: "PASSED",
        passed: true,
        durationMs: 950,
        expected: "Cart total displays $30.00",
        actual: "Cart total displays $30.00",
        testIds: [testId],
        evidenceIds: [],
        reportHash: postPatchReportHash,
        testFingerprint: fingerprint,
      },
      requiredChecks: [
        {
          checkId: "typecheck",
          name: "Typecheck",
          type: "typecheck",
          command: "npm run typecheck",
          passed: true,
          exitCode: 0,
          durationMs: 2500,
          output: "Found 0 errors.",
        },
        {
          checkId: "build",
          name: "Build",
          type: "build",
          command: "npm run build",
          passed: true,
          exitCode: 0,
          durationMs: 4000,
          output: "Build successful.",
        },
        {
          checkId: "unit-tests",
          name: "Unit Tests",
          type: "unit-tests",
          command: "npm run test:unit",
          passed: true,
          exitCode: 0,
          durationMs: 3000,
          output: "All unit tests passed.",
        },
      ],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return { verifiedRecord, baselineDir, verificationDir, checksDir, testSpecRelPath, fingerprint, testId };
  }

  it("builds a verified proof bundle ZIP with genuine evidence, extracts independently, and validates all byte hashes", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord } = createValidFixtures(testRunId, runDir);
    saveRunRecord(verifiedRecord);

    const bundle = await buildProofBundle(testRunId);

    expect(bundle.filename).toBe(`proof-bundle-case-001-${testRunId}.zip`);
    expect(bundle.buffer.length).toBeGreaterThan(100);

    // Extract archive with independent PKZIP extractor and recompute all byte hashes
    const extractedMap = extractZipArchive(bundle.buffer);
    expect(extractedMap.size).toBeGreaterThan(5);
    expect(extractedMap.has("manifest.json")).toBe(true);

    const extractedManifestRaw = extractedMap.get("manifest.json")!.toString("utf-8");
    const extractedManifest = JSON.parse(extractedManifestRaw);

    expect(extractedManifest.verified).toBe(true);
    expect(extractedManifest.runId).toBe(testRunId);
    expect(extractedManifest.reproductionProvenance).toMatchObject({ reproductionRunId: "generated-source-run", definitionHash: "a".repeat(64), compiledTestHash: "b".repeat(64) });

    // Check that every single file in the manifest matches the SHA-256 of extracted bytes
    for (const fileEntry of bundle.manifest.files) {
      expect(extractedMap.has(fileEntry.path)).toBe(true);
      const extractedBytes = extractedMap.get(fileEntry.path)!;
      const recomputedHash = sha256(extractedBytes);
      expect(recomputedHash).toBe(fileEntry.sha256);
      expect(extractedBytes.length).toBe(fileEntry.sizeBytes);
    }
  });

  it("rejects verified status when disk report bytes are tampered or do not match reportHash", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord, baselineDir } = createValidFixtures(testRunId, runDir);
    saveRunRecord(verifiedRecord);

    // Tamper with baseline/result.json after run creation
    fs.writeFileSync(path.join(baselineDir, "result.json"), JSON.stringify({ tampered: true }));

    const bundle = await buildProofBundle(testRunId);
    expect(bundle.manifest.verified).toBe(false);
    expect(bundle.manifest.verificationViolations).toBeDefined();
    expect(bundle.manifest.verificationViolations?.some((v) => v.includes("report hash mismatch"))).toBe(true);
  });

  it("rejects verified status when baseline and post-patch test identities do not match", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord } = createValidFixtures(testRunId, runDir);
    verifiedRecord.postPatchRun!.testIds = ["tests/playwright/cases/case-002-repeated-item-qty.spec.ts:other:chromium"];
    saveRunRecord(verifiedRecord);

    const bundle = await buildProofBundle(testRunId);
    expect(bundle.manifest.verified).toBe(false);
    expect(bundle.manifest.verificationViolations?.some((v) => v.includes("Test identity mismatch") || v.includes("test identities"))).toBe(true);
  });

  it("rejects verified status when mandatory regression checks are missing or failed", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord } = createValidFixtures(testRunId, runDir);
    // Drop "unit-tests" check
    verifiedRecord.requiredChecks = verifiedRecord.requiredChecks.filter((c) => c.type !== "unit-tests");
    saveRunRecord(verifiedRecord);

    const bundle = await buildProofBundle(testRunId);
    expect(bundle.manifest.verified).toBe(false);
    expect(bundle.manifest.verificationViolations?.some((v) => v.includes("unit-tests"))).toBe(true);
  });

  it("rejects verified status when proposal review decision was not approved", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord } = createValidFixtures(testRunId, runDir);
    verifiedRecord.review!.decision = "REJECTED";
    saveRunRecord(verifiedRecord);

    const bundle = await buildProofBundle(testRunId);
    expect(bundle.manifest.verified).toBe(false);
  });

  it("excludes unapproved and sensitive files placed alongside evidence in run directories", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord, baselineDir } = createValidFixtures(testRunId, runDir);
    saveRunRecord(verifiedRecord);

    // Place unapproved and sensitive files
    fs.writeFileSync(path.join(baselineDir, "unapproved.exe"), Buffer.from("binary payload"));
    fs.writeFileSync(path.join(baselineDir, "credentials.txt"), "secret_token_12345");

    const bundle = await buildProofBundle(testRunId);
    const extracted = extractZipArchive(bundle.buffer);

    // unapproved.exe and credentials.txt must NOT be present in extracted zip
    expect(extracted.has("baseline/unapproved.exe")).toBe(false);
    expect(extracted.has("baseline/credentials.txt")).toBe(false);
  });

  it("correctly includes nested Playwright artifacts without repeating directory names in ZIP paths", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord, baselineDir } = createValidFixtures(testRunId, runDir);
    saveRunRecord(verifiedRecord);

    // Create nested Playwright trace and screenshot directory
    const nestedDir = path.join(baselineDir, "case-001-cart-total-chromium");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, "test-failed-1.png"), Buffer.from("screenshot-bytes"));
    fs.writeFileSync(path.join(nestedDir, "trace.zip"), Buffer.from("trace-bytes"));

    const bundle = await buildProofBundle(testRunId);
    const extracted = extractZipArchive(bundle.buffer);

    // Ensure paths are clean and do not repeat folder names
    expect(extracted.has("baseline/case-001-cart-total-chromium/test-failed-1.png")).toBe(true);
    expect(extracted.has("baseline/case-001-cart-total-chromium/trace.zip")).toBe(true);
    expect(extracted.has("baseline/case-001-cart-total-chromium/case-001-cart-total-chromium/trace.zip")).toBe(false);
  });

  it("enforces pre-read size limits before reading oversized files", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const { verifiedRecord, baselineDir } = createValidFixtures(testRunId, runDir);
    saveRunRecord(verifiedRecord);

    const oversizedPath = path.join(baselineDir, "oversized-trace.zip");
    // Write a dummy file and mock its stat size to exceed MAX_ZIP_ENTRY_SIZE
    fs.writeFileSync(oversizedPath, "tiny header");
    const origStatSync = fs.statSync;
    const statSpy = vi.spyOn(fs, "statSync").mockImplementation((p, opts) => {
      if (typeof p === "string" && p.includes("oversized-trace.zip")) {
        return {
          size: MAX_ZIP_ENTRY_SIZE + 1000,
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false,
        } as any;
      }
      return origStatSync(p, opts);
    });

    await expect(buildProofBundle(testRunId)).rejects.toThrow(OversizedArchiveError);
    statSpy.mockRestore();
  });

  it("immutable run inputs: editing live case record after run creation does NOT alter exported snapshot", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const originalTitle = "Pristine Snapshot Title at Run Creation";
    const mutatedTitle = "MUTATED LIVE CASE TITLE THAT SHOULD NOT BE IN BUNDLE";

    const testSpecRelPath = "tests/playwright/cases/case-001-cart-total.spec.ts";
    const fingerprint = testFingerprint(testSpecRelPath);
    const testSpecContent = fs.readFileSync(path.resolve(WORKSPACE_ROOT, testSpecRelPath), "utf-8");

    const record: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: "case-001",
      mode: "dynamic",
      state: "BLOCKED",
      attempt: 1,
      maxAttempts: 3,
      inputs: {
        caseSnapshot: {
          id: "case-001",
          title: originalTitle,
          description: "Original description",
        },
        reproductionTest: {
          filePath: testSpecRelPath,
          content: testSpecContent,
          fingerprint,
        },
      },
      originalSourceFingerprint: "orig",
      targetSnapshotDir: runDir,
      testFingerprint: fingerprint,
      reproductionTestFile: testSpecRelPath,
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRunRecord(record);

    // Mutate live case record on disk
    const liveCase = readCase("case-001");
    if (liveCase) {
      writeCase({
        ...liveCase,
        title: mutatedTitle,
      });
    }

    const bundle = await buildProofBundle(testRunId);
    const extracted = extractZipArchive(bundle.buffer);
    const snapshotRaw = extracted.get("case-snapshot.json")!.toString("utf-8");
    const snapshot = JSON.parse(snapshotRaw);

    expect(snapshot.title).toBe(originalTitle);
    expect(snapshot.title).not.toBe(mutatedTitle);
  });

  it("reports historical inputs as UNAVAILABLE for legacy runs without inputs", async () => {
    const { testRunId, runDir } = getUniqueRunDir();
    const legacyRecord: RepairRunRecord = {
      schemaVersion: "1.0",
      runId: testRunId,
      caseId: "case-001",
      mode: "dynamic",
      state: "BLOCKED",
      attempt: 1,
      maxAttempts: 3,
      originalSourceFingerprint: "orig",
      targetSnapshotDir: runDir,
      testFingerprint: "fp",
      reproductionTestFile: "tests/playwright/cases/case-001-cart-total.spec.ts",
      requiredChecks: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRunRecord(legacyRecord);

    const bundle = await buildProofBundle(testRunId);
    const extracted = extractZipArchive(bundle.buffer);
    const snapshotRaw = extracted.get("case-snapshot.json")!.toString("utf-8");
    const snapshot = JSON.parse(snapshotRaw);

    expect(snapshot.status).toBe("UNAVAILABLE");
    expect(bundle.manifest.verified).toBe(false);
  });

  it("enforces filesystem containment and rejects symlink / junction escape and sensitive files", () => {
    const { runDir } = getUniqueRunDir();
    const tempTestDir = path.join(runDir, "security-test");
    fs.mkdirSync(tempTestDir, { recursive: true });

    // 1. Path traversal attempts
    expect(() => validateArtifactContainment("../../etc/passwd", tempTestDir)).toThrow(/traversal/i);
    expect(() => validateArtifactContainment("..\\..\\secret.env", tempTestDir)).toThrow(/traversal/i);
    expect(() => validateArtifactContainment("sub/\0invalid", tempTestDir)).toThrow(/null byte/i);

    // 2. Sensitive file names
    const envFile = path.join(tempTestDir, ".env");
    fs.writeFileSync(envFile, "SECRET_KEY=12345");
    expect(() => validateArtifactContainment(envFile, tempTestDir)).toThrow(/forbidden sensitive/i);

    const credsFile = path.join(tempTestDir, "credentials");
    fs.writeFileSync(credsFile, "user:password");
    expect(() => validateArtifactContainment(credsFile, tempTestDir)).toThrow(/forbidden sensitive/i);
  });

  it("enforces archive size limits and returns OversizedArchiveError", () => {
    const oversizedEntries = Array.from({ length: 250 }, (_, i) => ({
      path: `file-${i}.txt`,
      data: `content-${i}`,
    }));

    expect(() => createZipArchive(oversizedEntries)).toThrow(OversizedArchiveError);
  });
});
