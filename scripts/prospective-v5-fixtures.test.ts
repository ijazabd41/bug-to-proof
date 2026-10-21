import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prospectiveV5Fixtures } from "../data/evals/prospective-v5-fixtures";

describe("prospective v5 MiniShop fixtures", () => {
  it("keeps new cases distinct with complete reports and exact source snippets", () => {
    const heldOut = prospectiveV5Fixtures.filter(item => item.split !== "dev");
    expect(prospectiveV5Fixtures.filter(item => item.split === "dev")).toHaveLength(2);
    expect(heldOut.filter(item => item.label === "answerable-bug")).toHaveLength(12);
    expect(heldOut.filter(item => item.label === "control")).toHaveLength(2);
    expect(new Set(prospectiveV5Fixtures.map(item => item.id)).size).toBe(prospectiveV5Fixtures.length);
    for (const item of prospectiveV5Fixtures) {
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
