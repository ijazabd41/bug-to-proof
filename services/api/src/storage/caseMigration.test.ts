import { describe, expect, it } from "vitest";
import seed from "../routes/legacy-case.fixture.json";
import { normalizeCaseRecord } from "./caseStore";
import type { BugCase } from "@bug-to-proof/shared-types";

describe("case report migration", () => {
  it("derives a versioned report from legacy reproduction fields without changing them", () => {
    const migrated = normalizeCaseRecord(structuredClone(seed) as BugCase);

    expect(migrated.report).toEqual({
      schemaVersion: "1.0",
      steps: seed.reproduction.steps,
      expected: seed.reproduction.expected,
      actual: seed.reproduction.actual,
      startPath: "",
      context: "",
    });
    expect(migrated.reproduction).toEqual(seed.reproduction);
  });

  it("preserves an existing structured report", () => {
    const report = {
      schemaVersion: "1.0" as const,
      steps: ["Use keyboard navigation"],
      expected: "Focus remains visible",
      actual: "Focus disappears",
      startPath: "/cart",
      context: "Desktop Chromium",
    };
    expect(normalizeCaseRecord({ ...structuredClone(seed), report } as BugCase).report).toEqual(report);
  });
});
