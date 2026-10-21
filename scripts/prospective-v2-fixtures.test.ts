import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prospectiveV2Fixtures } from "../data/evals/prospective-v2-fixtures";

describe("new prospective MiniShop fixtures", () => {
  it("has distinct held-out reports and exact source seeding snippets", () => {
    const heldOut = prospectiveV2Fixtures.filter(item => item.split !== "dev");
    expect(heldOut.filter(item => item.label === "answerable-bug")).toHaveLength(12);
    expect(heldOut.filter(item => item.label === "control")).toHaveLength(2);
    expect(new Set(prospectiveV2Fixtures.map(item => item.id)).size).toBe(prospectiveV2Fixtures.length);
    for (const item of prospectiveV2Fixtures) {
      expect(item.report.steps.length).toBeGreaterThan(0);
      expect(item.report.expected).toBeTruthy();
      expect(item.report.actual).toBeTruthy();
      for (const defect of item.defects) {
        const source = fs.readFileSync(path.join(import.meta.dirname, "..", "apps", "minishop", defect.relativePath), "utf8").replace(/\r\n/g, "\n");
        expect(source.split(defect.fixedContent).length, `${item.id}: ${defect.relativePath}`).toBe(2);
      }
    }
  });
});
