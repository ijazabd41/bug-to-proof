import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { runArtifactCleanup } from "../utils/cleanupArtifacts";
import { ARTIFACTS_DIR } from "../utils/paths";

describe("Artifact Cleanup Tool", () => {
  const fixtureDir = path.join(ARTIFACTS_DIR, "runs", "test-cleanup-fixture");

  beforeEach(() => {
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.mkdirSync(path.join(fixtureDir, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, "workspace", "scratch.txt"), "temporary bytes");
    fs.writeFileSync(
      path.join(fixtureDir, "run.json"),
      JSON.stringify({
        runId: "test-cleanup-fixture",
        caseId: "case-001",
        state: "VERIFIED", // terminal state
      })
    );
  });

  afterEach(() => {
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("dry-run mode does not delete any files", async () => {
    await runArtifactCleanup({ force: false });

    expect(fs.existsSync(path.join(fixtureDir, "workspace", "scratch.txt"))).toBe(true);
    expect(fs.existsSync(path.join(fixtureDir, "run.json"))).toBe(true);
  }, 30000);

  it("protects active and awaiting-review runs from cleanup", async () => {
    // Modify run to active state
    fs.writeFileSync(
      path.join(fixtureDir, "run.json"),
      JSON.stringify({
        runId: "test-cleanup-fixture",
        caseId: "case-001",
        state: "AWAITING_REVIEW",
      })
    );

    await runArtifactCleanup({ force: true });

    // Workspace should still exist because run is in AWAITING_REVIEW
    expect(fs.existsSync(path.join(fixtureDir, "workspace", "scratch.txt"))).toBe(true);
    expect(fs.existsSync(path.join(fixtureDir, "run.json"))).toBe(true);
  }, 30000);
});
