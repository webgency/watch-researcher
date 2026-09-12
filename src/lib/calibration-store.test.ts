import { describe, expect, it } from "vitest";
import { validateBenchmarks } from "./calibration-store";

describe("calibration benchmark validation", () => {
  it("accepts saved judgments", () => {
    expect(validateBenchmarks([{
      watchId: "w1",
      value: "fair",
      wearability: "too-high",
      notes: "A little generous",
      updatedAt: "2026-09-05T17:00:00Z",
    }])).toHaveLength(1);
  });

  it("rejects unsupported judgments", () => {
    expect(() => validateBenchmarks([{
      watchId: "w1",
      value: "perfect",
      updatedAt: "2026-09-05T17:00:00Z",
    }])).toThrow("value is invalid");
  });
});
