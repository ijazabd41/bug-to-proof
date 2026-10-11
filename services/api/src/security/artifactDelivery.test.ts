import { describe, expect, it } from "vitest";
import request from "supertest";
import app, { isAllowedArtifactPath } from "../index";

describe("Artifact Delivery Path Resolution & Boundary Rules", () => {
  describe("isAllowedArtifactPath unit checks", () => {
    it("allows real Playwright runner artifact paths under caseId/phase/runId/", () => {
      expect(isAllowedArtifactPath("case-001/before/run-123/result.json")).toBe(true);
      expect(isAllowedArtifactPath("case-001/after/run-abc-456/screenshot.png")).toBe(true);
      expect(isAllowedArtifactPath("case-001/before/run-123/case-001-cart-total-chromium/test-failed-1.png")).toBe(true);
      expect(isAllowedArtifactPath("case-001/after/run-123/trace.zip")).toBe(true);
      expect(isAllowedArtifactPath("case-001/before/run-123/output.log")).toBe(true);
      expect(isAllowedArtifactPath("case-001/before/run-123/manifest.json")).toBe(true);
    });

    it("allows agent debug reports and report.json under agent/runId/", () => {
      expect(isAllowedArtifactPath("agent/run-123/report.json")).toBe(true);
      expect(isAllowedArtifactPath("agent/debug-report-run-123.md")).toBe(true);
      expect(isAllowedArtifactPath("agent/run-123/debug-report.md")).toBe(true);
    });

    it("allows public repair run records and logs under runs/ while blocking internal source and checkpoints", () => {
      // Public run records and verification logs
      expect(isAllowedArtifactPath("runs/run-123/run.json")).toBe(true);
      expect(isAllowedArtifactPath("runs/run-123/baseline/output.log")).toBe(true);
      expect(isAllowedArtifactPath("runs/run-123/attempt-1/verification/output.log")).toBe(true);
      expect(isAllowedArtifactPath("runs/run-123/attempt-1/checks/tsc.log")).toBe(true);

      // STRICTLY FORBIDDEN: Internal workspaces, source files, checkpoints, locks
      expect(isAllowedArtifactPath("runs/run-123/workspace/apps/minishop/src/store/cartStore.ts")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/workspace/package.json")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/pristine/apps/minishop/src/store/cartStore.ts")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/checkpoints/chk-1.json")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/run.lock")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/.workspace.lock")).toBe(false);
    });

    it("blocks directory traversal", () => {
      expect(isAllowedArtifactPath("../package.json")).toBe(false);
      expect(isAllowedArtifactPath("case-001/../../../package.json")).toBe(false);
      expect(isAllowedArtifactPath("runs/run-123/../../package.json")).toBe(false);
    });
  });

  describe("HTTP endpoint /artifacts boundary enforcement", () => {
    it("blocks access to internal workspace source code inside run sandbox", async () => {
      const res = await request(app).get("/artifacts/runs/run-123/workspace/apps/minishop/src/store/cartStore.ts");
      expect([403, 404]).toContain(res.status);
      if (res.status === 403) {
        expect(res.body.error).toMatch(/forbidden/i);
      }
    });

    it("blocks access to internal checkpoints", async () => {
      const res = await request(app).get("/artifacts/runs/run-123/checkpoints/chk-1.json");
      expect([403, 404]).toContain(res.status);
    });

    it("blocks path traversal queries", async () => {
      const res = await request(app).get("/artifacts/%2e%2e%2fpackage.json");
      expect([400, 403, 404]).toContain(res.status);
    });
  });
});
