import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import request from "supertest";
import app from "../index";
import { writeCase, readCase, deleteCase, CaseStorageError } from "./caseStore";
import seed from "../routes/legacy-case.fixture.json";
import type { BugCase } from "@bug-to-proof/shared-types";

describe("Atomic Case Persistence & Failure Resilience", () => {
  const caseId = "case-atomic-test";

  beforeEach(() => {
    const bugCase: BugCase = {
      ...(structuredClone(seed) as BugCase),
      id: caseId,
      title: "Initial Original Title",
    };
    writeCase(bugCase);
  });

  afterEach(() => {
    deleteCase(caseId);
    vi.restoreAllMocks();
  });

  it("preserves previous record and throws retryable error when atomic replacement fails, without blocking via Atomics.wait", () => {
    const original = readCase(caseId);
    expect(original?.title).toBe("Initial Original Title");

    const atomicsWaitSpy = vi.spyOn(Atomics, "wait");

    // Mock renameSync and copyFileSync to fail with EBUSY/EPERM
    const renameSpy = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      const err: any = new Error("Resource locked");
      err.code = "EBUSY";
      throw err;
    });
    const copySpy = vi.spyOn(fs, "copyFileSync").mockImplementation(() => {
      const err: any = new Error("Resource locked");
      err.code = "EBUSY";
      throw err;
    });

    const updatedCase: BugCase = {
      ...original!,
      title: "Corrupted Modification",
    };

    // Expect writeCase to throw retryable CaseStorageError without partial file overwrite
    expect(() => writeCase(updatedCase)).toThrow(CaseStorageError);

    // Verify Atomics.wait was NOT called (no main thread blocking)
    expect(atomicsWaitSpy).not.toHaveBeenCalled();

    renameSpy.mockRestore();
    copySpy.mockRestore();

    // The original file on disk must remain pristine and intact
    const afterFailedWrite = readCase(caseId);
    expect(afterFailedWrite?.title).toBe("Initial Original Title");
  });

  it("returns 503 with structured retryable error when storage write fails during API PATCH", async () => {
    const renameSpy = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      const err: any = new Error("Disk contention");
      err.code = "EBUSY";
      throw err;
    });
    const copySpy = vi.spyOn(fs, "copyFileSync").mockImplementation(() => {
      const err: any = new Error("Disk contention");
      err.code = "EBUSY";
      throw err;
    });

    const res = await request(app)
      .patch(`/api/cases/${caseId}`)
      .send({ title: "Failed Update" });

    renameSpy.mockRestore();
    copySpy.mockRestore();

    expect(res.status).toBe(503);
    expect(res.body.retryable).toBe(true);
    expect(res.body.error).toMatch(/storage/i);

    // Verify previous case record was preserved
    const caseRecord = readCase(caseId);
    expect(caseRecord?.title).toBe("Initial Original Title");
  });
});

