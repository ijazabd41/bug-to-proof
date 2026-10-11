import { beforeEach, describe, expect, it } from "vitest";
import type { BugCase } from "@bug-to-proof/shared-types";
import { recoverInterruptedLegacyCases } from "../storage/caseStore";
import seed from "../routes/legacy-case.fixture.json";

let mockCases: BugCase[] = [];

const mockWriter = (c: BugCase) => {
  const idx = mockCases.findIndex((x) => x.id === c.id);
  if (idx >= 0) mockCases[idx] = structuredClone(c);
  else mockCases.push(structuredClone(c));
};

describe("Legacy Case Startup Reconciliation", () => {
  beforeEach(() => {
    mockCases = [
      {
        ...(structuredClone(seed) as BugCase),
        id: "case-reproducing",
        status: "REPRODUCING",
      },
      {
        ...(structuredClone(seed) as BugCase),
        id: "case-verifying",
        status: "VERIFYING",
      },
      {
        ...(structuredClone(seed) as BugCase),
        id: "case-normal",
        status: "REPORTED",
      },
    ];
  });

  it("reconciles cases stuck in REPRODUCING on server restart to REPRODUCTION_FAILED without inventing fake outcomes", () => {
    recoverInterruptedLegacyCases(mockCases, mockWriter);
    const reproducingCase = mockCases.find((c) => c.id === "case-reproducing");
    expect(reproducingCase?.status).toBe("REPRODUCTION_FAILED");
  });

  it("reconciles cases stuck in VERIFYING on server restart to VERIFICATION_FAILED without inventing fake outcomes", () => {
    recoverInterruptedLegacyCases(mockCases, mockWriter);
    const verifyingCase = mockCases.find((c) => c.id === "case-verifying");
    expect(verifyingCase?.status).toBe("VERIFICATION_FAILED");
    if (verifyingCase?.verification) {
      expect(verifyingCase.verification.status).toBe("VERIFICATION_FAILED");
    }
  });

  it("leaves idle/completed cases unchanged", () => {
    recoverInterruptedLegacyCases(mockCases, mockWriter);
    const normalCase = mockCases.find((c) => c.id === "case-normal");
    expect(normalCase?.status).toBe("REPORTED");
  });
});
