import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../index";

describe("API Security & Exposure Defaults", () => {
  describe("CORS Restrictions", () => {
    it("allows configured local dashboard origin", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:5173");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });

    it("allows 127.0.0.1 dashboard origin", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://127.0.0.1:5173");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    });

    it("does not allow arbitrary untrusted origin", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://malicious-external-site.com");
      expect(res.headers["access-control-allow-origin"]).not.toBe("http://malicious-external-site.com");
    });
  });

  describe("Artifact Delivery Boundary", () => {
    it("blocks access to internal run records, workspaces, and checkpoints", async () => {
      const resWorkspace = await request(app).get("/artifacts/runs/run-123/workspace/apps/minishop/src/store/cartStore.ts");
      expect([403, 404]).toContain(resWorkspace.status);

      const resCheckpoints = await request(app).get("/artifacts/runs/run-123/checkpoints/chk-1.json");
      expect([403, 404]).toContain(resCheckpoints.status);
    });

    it("blocks path traversal attempts", async () => {
      const resTraversal = await request(app).get("/artifacts/%2e%2e%2fpackage.json");
      expect([400, 403, 404]).toContain(resTraversal.status);
    });

    it("allows access to case evidence paths", async () => {
      const res = await request(app).get("/artifacts/case-001/before/result.json");
      expect([200, 404]).toContain(res.status);
    });
  });
});
