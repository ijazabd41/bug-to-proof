import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prospectiveV3Fixtures } from "../data/evals/prospective-v3-fixtures";
import { validateDataset, type EvaluationDataset } from "./arbitrary-evaluation-core";

describe("prospective v3 MiniShop fixtures", () => {
  it("keeps the consumed cohort distinct, complete, and bound to its frozen dataset", () => {
    const frozen = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "data", "evals", "arbitrary-reproduction-v3.json"), "utf8")) as EvaluationDataset;
    validateDataset(frozen);
    expect(frozen.cases).toHaveLength(prospectiveV3Fixtures.length);
    const heldOut = prospectiveV3Fixtures.filter(item => item.split !== "dev");
    expect(prospectiveV3Fixtures.filter(item => item.split === "dev")).toHaveLength(2);
    expect(heldOut.filter(item => item.label === "answerable-bug")).toHaveLength(12);
    expect(heldOut.filter(item => item.label === "control")).toHaveLength(2);
    expect(new Set(prospectiveV3Fixtures.map(item => item.id)).size).toBe(prospectiveV3Fixtures.length);
    for (const [index, item] of prospectiveV3Fixtures.entries()) {
      expect(item.report.steps.length).toBeGreaterThan(0);
      expect(item.report.expected).toBeTruthy();
      expect(item.report.actual).toBeTruthy();
      expect(frozen.cases[index]).toMatchObject({
        id: item.id,
        split: item.split ?? "held-out",
        category: item.category,
        label: item.label,
        report: item.report,
        defects: item.defects,
        referenceTest: item.referenceTest,
      });
      expect(frozen.cases[index].variantFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(frozen.cases[index].referenceTestHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
