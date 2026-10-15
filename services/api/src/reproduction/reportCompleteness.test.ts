import { describe, expect, it } from "vitest";
import { assessReportCompleteness } from "./reportCompleteness";

describe("report completeness", () => {
  it("identifies each missing behavior field precisely", () => {
    expect(assessReportCompleteness({
      schemaVersion: "1.0",
      steps: [],
      expected: "",
      actual: "",
      startPath: "",
      context: "",
    })).toEqual({
      complete: false,
      missingFields: ["steps", "expected", "actual"],
    });
  });

  it("accepts a bounded report without requiring optional path or context", () => {
    expect(assessReportCompleteness({
      schemaVersion: "1.0",
      steps: ["Open the cart", "Add two products"],
      expected: "The total equals both products",
      actual: "Only the first product is included",
      startPath: "",
      context: "",
    })).toEqual({ complete: true, missingFields: [] });
  });
});
