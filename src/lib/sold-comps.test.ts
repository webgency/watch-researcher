import { describe, expect, it } from "vitest";
import { soldComps, soldCompSummary } from "./sold-comps";
import { dealScore, marketValueSummary } from "./valuation";
import { normalizeWatchPatch } from "./validation";
import type { SoldComp, Watch } from "./types";

const NOW = new Date("2026-09-13T00:00:00.000Z");

function comp(overrides: Partial<SoldComp> = {}): SoldComp {
  return {
    price: { amount: 5000, currency: "USD" },
    condition: "pre-owned",
    soldAt: "2026-09-01T00:00:00.000Z",
    source: "auction-a",
    ...overrides,
  };
}

function watch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: "t1",
    brand: "Test",
    model: "Test",
    status: "wishlist",
    price: { amount: 6000, currency: "USD" },
    specs: {},
    tags: [],
    links: [],
    dateAdded: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sold comps", () => {
  it("sorts newest first and dates each sale", () => {
    const result = soldComps(
      { soldComps: [comp({ soldAt: "2026-07-01T00:00:00.000Z" }), comp({ soldAt: "2026-09-10T00:00:00.000Z" })] },
      NOW
    );
    expect(result.map((c) => c.soldAt.slice(0, 10))).toEqual(["2026-09-10", "2026-07-01"]);
    expect(result[0].ageDays).toBe(3);
    expect(result[0].freshness).toBe("fresh");
  });

  it("keeps each sale's stored position through the date sort", () => {
    // Removal targets the stored entry; pointing at the sorted row would
    // delete a different sale.
    const stored = [comp({ soldAt: "2026-07-01T00:00:00.000Z" }), comp({ soldAt: "2026-09-10T00:00:00.000Z" })];
    const result = soldComps({ soldComps: stored }, NOW);
    expect(result.map((c) => c.index)).toEqual([1, 0]);
    expect(stored[result[0].index].soldAt).toBe(result[0].soldAt);
  });

  it("withholds a median until two sales exist", () => {
    expect(soldCompSummary({ soldComps: [comp()] }, undefined, NOW).medianUsd).toBeUndefined();
    const two = soldCompSummary(
      { soldComps: [comp(), comp({ price: { amount: 5400, currency: "USD" } })] },
      undefined,
      NOW
    );
    expect(two.medianUsd).toBe(5200);
    expect([two.lowUsd, two.highUsd]).toEqual([5000, 5400]);
  });

  it("filters by condition when asked", () => {
    const mixed = { soldComps: [comp(), comp({ condition: "new" })] };
    expect(soldCompSummary(mixed, "new", NOW).comps).toHaveLength(1);
  });
});

describe("sold comps never enter the ask-based scores", () => {
  // The deal score compares an ask with other asks. Letting a hand-entered
  // sale move it would change what the percentage means while it still reads
  // as "below fair asks".
  const links: Watch["links"] = [
    { url: "https://a.example/x", price: { amount: 6200, currency: "USD" }, condition: "new", observedAt: "2026-09-10T00:00:00.000Z" },
    { url: "https://b.example/x", price: { amount: 6400, currency: "USD" }, condition: "new", observedAt: "2026-09-09T00:00:00.000Z" },
  ];

  it("leaves dealScore and marketValueSummary unchanged", () => {
    const without = watch({ links });
    const withSolds = watch({ links, soldComps: [comp({ price: { amount: 1000, currency: "USD" } }), comp()] });

    const a = dealScore(without, "new", NOW);
    const b = dealScore(withSolds, "new", NOW);
    expect(a.status).toBe("available");
    expect(b).toEqual(a);
    expect(marketValueSummary(withSolds, "new", NOW)).toEqual(marketValueSummary(without, "new", NOW));
  });

  it("still reports insufficient evidence when only sales are recorded", () => {
    const soldsOnly = watch({ soldComps: [comp(), comp({ price: { amount: 5400, currency: "USD" } })] });
    const deal = dealScore(soldsOnly, "new", NOW);
    expect(deal.status).toBe("insufficient");
    expect(deal.confidence).toBe("insufficient");
  });
});

describe("sold comp validation", () => {
  it("accepts a complete comp and drops blank optional fields", () => {
    const result = normalizeWatchPatch({ soldComps: [{ ...comp(), url: "", notes: "full set" }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.soldComps).toEqual([{ ...comp(), notes: "full set" }]);
  });

  it.each([
    ["price", { price: undefined }],
    ["condition", { condition: undefined }],
    ["soldAt", { soldAt: undefined }],
    ["source", { source: undefined }],
  ])("rejects a comp missing %s", (field, patch) => {
    const result = normalizeWatchPatch({ soldComps: [{ ...comp(), ...patch }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain(`soldComps[0].${field}`);
  });

  it("clears the field when the last comp is removed", () => {
    // RemoveSoldComp sends null so the file carries no empty array.
    const result = normalizeWatchPatch({ soldComps: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("soldComps" in result.data).toBe(true);
    expect(result.data.soldComps).toBeUndefined();
  });

  it("rejects a condition outside new and pre-owned", () => {
    const result = normalizeWatchPatch({ soldComps: [{ ...comp(), condition: "mint" }] });
    expect(result.ok).toBe(false);
  });
});
