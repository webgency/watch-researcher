import { describe, expect, it } from "vitest";

import { normalizeWatchInput, normalizeWatchPatch } from "./validation";

const base = {
  brand: "Test",
  model: "Watch",
  status: "wishlist",
  links: [],
  specs: {},
  tags: [],
};

describe("scoring category validation", () => {
  it("accepts a supported explicit scoring category", () => {
    const result = normalizeWatchInput({ ...base, scoringCategory: "gmt" });
    expect(result).toEqual({ ok: true, data: { ...base, scoringCategory: "gmt" } });
  });

  it("rejects an unsupported scoring category", () => {
    const result = normalizeWatchInput({ ...base, scoringCategory: "field" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("scoringCategory must be one of diver, chronograph, gmt, dress");
  });

  it("clears an explicit category when a patch sends null", () => {
    expect(normalizeWatchPatch({ scoringCategory: null })).toEqual({
      ok: true,
      data: { scoringCategory: undefined },
    });
  });
});

describe("design preference validation", () => {
  it("accepts pairwise rating metadata", () => {
    expect(normalizeWatchPatch({ designPreferenceElo: 1016, designComparisonCount: 3 })).toEqual({
      ok: true,
      data: { designPreferenceElo: 1016, designComparisonCount: 3 },
    });
  });

  it("clears pairwise metadata with nulls", () => {
    expect(normalizeWatchPatch({ designPreferenceElo: null, designComparisonCount: null })).toEqual({
      ok: true,
      data: { designPreferenceElo: undefined, designComparisonCount: undefined },
    });
  });

  it("rejects negative Elo and fractional comparison counts", () => {
    const result = normalizeWatchPatch({ designPreferenceElo: -1, designComparisonCount: 1.5 });
    expect(result.ok).toBe(false);
  });
});
