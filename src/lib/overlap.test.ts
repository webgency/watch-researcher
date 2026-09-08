import { describe, expect, it } from "vitest";

import {
  EXCLUSION_LABELS,
  MIN_CLUSTER_SIZE,
  PRICE_RATIO_LIMIT,
  SIZE_TOLERANCE_MM,
  findOverlaps,
} from "./overlap";
import type { Watch } from "./types";

let nextId = 0;

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  nextId += 1;
  return {
    id: `test-${nextId}`,
    brand: "Testbrand",
    model: "Model",
    status: "wishlist",
    scoringCategory: "diver",
    price: { amount: 1000, currency: "USD" },
    links: [],
    specs: { caseDiameterMm: 40 },
    tags: [],
    dateAdded: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** A diver at a given size and USD price, with everything else held constant. */
function diver(id: string, diameterMm: number, amount: number, overrides: Partial<Watch> = {}): Watch {
  return makeWatch({
    id,
    price: { amount, currency: "USD" },
    ...overrides,
    specs: { caseDiameterMm: diameterMm, ...overrides.specs },
  });
}

describe("findOverlaps grouping", () => {
  it("groups two watches that wear and cost the same", () => {
    const report = findOverlaps([diver("a", 40, 1000), diver("b", 40, 1000)]);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].members.map((m) => m.watch.id).sort()).toEqual(["a", "b"]);
    expect(report.distinctCount).toBe(0);
    expect(report.checkedCount).toBe(2);
  });

  it("keeps different categories apart even at identical size and price", () => {
    const report = findOverlaps([
      diver("a", 40, 1000),
      diver("b", 40, 1000, { scoringCategory: "dress" }),
    ]);
    expect(report.clusters).toHaveLength(0);
    expect(report.distinctCount).toBe(2);
  });

  it("treats the size tolerance as inclusive and stops just past it", () => {
    const inside = findOverlaps([diver("a", 39, 1000), diver("b", 39 + SIZE_TOLERANCE_MM, 1000)]);
    expect(inside.clusters).toHaveLength(1);

    const outside = findOverlaps([diver("a", 39, 1000), diver("b", 39 + SIZE_TOLERANCE_MM + 0.1, 1000)]);
    expect(outside.clusters).toHaveLength(0);
  });

  it("treats the price ratio as inclusive and stops just past it", () => {
    const inside = findOverlaps([diver("a", 40, 1000), diver("b", 40, 1000 * PRICE_RATIO_LIMIT)]);
    expect(inside.clusters).toHaveLength(1);

    const outside = findOverlaps([diver("a", 40, 1000), diver("b", 40, 1000 * PRICE_RATIO_LIMIT + 1)]);
    expect(outside.clusters).toHaveLength(0);
  });

  it("compares prices in normalized USD, not raw amounts", () => {
    // Same nominal amount, different currency: the EUR watch is worth more in
    // USD, and the group's own price span has to reflect that.
    const report = findOverlaps([
      diver("usd", 40, 1000),
      makeWatch({ id: "eur", price: { amount: 1000, currency: "EUR" }, specs: { caseDiameterMm: 40 } }),
    ]);
    expect(report.clusters).toHaveLength(1);
    const [low, high] = report.clusters[0].priceRangeUsd;
    expect(low).toBe(1000);
    expect(high).toBeGreaterThan(1000);
  });

  it("does not chain a group through a middle member", () => {
    // 38 and 41 are 3mm apart and are not the same watch, even though 39.4
    // is within tolerance of both. Single-link clustering would merge all three.
    const report = findOverlaps([diver("a", 38, 1000), diver("b", 39.4, 1000), diver("c", 41, 1000)]);
    for (const cluster of report.clusters) {
      const ids = cluster.members.map((m) => m.watch.id);
      expect(ids.includes("a") && ids.includes("c")).toBe(false);
      expect(cluster.diameterRange[1] - cluster.diameterRange[0]).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
    }
  });

  it("never emits a group below the minimum size", () => {
    const report = findOverlaps([diver("a", 36, 1000), diver("b", 40, 1000), diver("c", 44, 1000)]);
    expect(report.clusters).toHaveLength(0);
    for (const cluster of report.clusters) {
      expect(cluster.members.length).toBeGreaterThanOrEqual(MIN_CLUSTER_SIZE);
    }
  });

  it("produces the same groups and ids regardless of input order", () => {
    const watches = [diver("a", 40, 1000), diver("b", 40.5, 1100), diver("c", 44, 2000), diver("d", 44, 2100)];
    const forward = findOverlaps(watches);
    const reversed = findOverlaps([...watches].reverse());
    expect(forward.clusters.map((c) => c.id)).toEqual(reversed.clusters.map((c) => c.id));
  });
});

describe("findOverlaps exclusions", () => {
  it("reports a missing input rather than guessing one", () => {
    const report = findOverlaps([
      makeWatch({ id: "nocat", scoringCategory: undefined, tags: [] }),
      makeWatch({ id: "nosize", specs: {} }),
      makeWatch({ id: "noprice", price: undefined }),
      makeWatch({ id: "sold", status: "sold" }),
    ]);
    expect(report.clusters).toHaveLength(0);
    expect(report.checkedCount).toBe(0);
    expect(Object.fromEntries(report.unchecked.map((u) => [u.watch.id, u.reason]))).toEqual({
      nocat: "no-category",
      nosize: "no-diameter",
      noprice: "no-price",
      sold: "sold",
    });
  });

  it("labels every exclusion reason it can emit", () => {
    const report = findOverlaps([
      makeWatch({ scoringCategory: undefined, tags: [] }),
      makeWatch({ specs: {} }),
      makeWatch({ price: undefined }),
      makeWatch({ status: "sold" }),
    ]);
    for (const entry of report.unchecked) {
      expect(EXCLUSION_LABELS[entry.reason]).toBeTruthy();
    }
  });

  it("groups an owned watch alongside wishlist candidates and flags it", () => {
    // "You already own one of these" is the strongest reason to skip a group.
    const report = findOverlaps([diver("wish", 40, 1000), diver("have", 40, 1050, { status: "owned" })]);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].ownedIds).toEqual(["have"]);
  });
});

describe("findOverlaps leaders", () => {
  const rated = (id: string, opts: { caliber?: string; wr?: number; design?: number; amount?: number }) =>
    diver(id, 40, opts.amount ?? 1000, {
      designUniqueness: opts.design,
      specs: { caseDiameterMm: 40, caseThicknessMm: 12, caliber: opts.caliber, waterResistanceM: opts.wr },
    });

  it("names a value leader and a design leader separately", () => {
    const report = findOverlaps([
      rated("strong", { caliber: "SW300", wr: 300, design: 2 }),
      rated("pretty", { caliber: "NH35", wr: 100, design: 5 }),
    ]);
    const cluster = report.clusters[0];
    expect(cluster.valueLeaderIds).toEqual(["strong"]);
    expect(cluster.designLeaderIds).toEqual(["pretty"]);
    expect(cluster.agreement).toBe("diverge");
  });

  it("reports agreement when one watch leads both axes", () => {
    const report = findOverlaps([
      rated("best", { caliber: "SW300", wr: 300, design: 5 }),
      rated("rest", { caliber: "NH35", wr: 100, design: 2 }),
    ]);
    const cluster = report.clusters[0];
    expect(cluster.agreement).toBe("agree");
    expect(cluster.valueLeaderIds).toEqual(cluster.designLeaderIds);
  });

  it("returns every tied id rather than inventing a winner", () => {
    const report = findOverlaps([rated("a", { caliber: "SW300", wr: 300 }), rated("b", { caliber: "SW300", wr: 300 })]);
    const cluster = report.clusters[0];
    expect(cluster.valueLeaderIds).toHaveLength(2);
    // Neither is design-rated, so there is no design leader and no verdict.
    expect(cluster.designLeaderIds).toEqual([]);
    expect(cluster.agreement).toBe("unknown");
  });

  it("leaves both leader lists empty when nothing is rated", () => {
    // No caliber, no water resistance, no design rank: no score is not a low
    // score, so the group still exists but names no winner.
    const report = findOverlaps([diver("a", 40, 1000), diver("b", 40, 1000)]);
    const cluster = report.clusters[0];
    expect(cluster.valueLeaderIds).toEqual([]);
    expect(cluster.designLeaderIds).toEqual([]);
    expect(cluster.agreement).toBe("unknown");
  });

  it("sorts unrated members last instead of treating them as worst", () => {
    const report = findOverlaps([
      diver("unrated", 40, 1000),
      rated("weak", { caliber: "NH35", wr: 100 }),
      rated("strong", { caliber: "SW300", wr: 300 }),
    ]);
    expect(report.clusters[0].members.map((m) => m.watch.id)).toEqual(["strong", "weak", "unrated"]);
  });
});

describe("findOverlaps reporting", () => {
  it("flags a brand appearing twice in one group", () => {
    const report = findOverlaps([
      diver("a", 40, 1000, { brand: "Omega", model: "Seamaster" }),
      diver("b", 40, 1000, { brand: "Omega", model: "Seamaster — Blue" }),
      diver("c", 40, 1000, { brand: "Tudor" }),
    ]);
    expect(report.clusters[0].repeatedBrands).toEqual(["Omega"]);
  });

  it("describes the group by its size and price span", () => {
    const report = findOverlaps([diver("a", 39, 800), diver("b", 40, 1000)]);
    expect(report.clusters[0].label).toBe("39-40mm divers, $800-1,000");
    expect(report.clusters[0].diameterRange).toEqual([39, 40]);
  });

  it("counts checked watches that matched nothing as distinct", () => {
    const report = findOverlaps([diver("a", 40, 1000), diver("b", 40, 1000), diver("lonely", 46, 300)]);
    expect(report.checkedCount).toBe(3);
    expect(report.distinctCount).toBe(1);
  });

  it("orders the biggest, most expensive groups first", () => {
    const report = findOverlaps([
      diver("cheap1", 36, 300),
      diver("cheap2", 36, 320),
      diver("big1", 42, 5000),
      diver("big2", 42, 5200),
      diver("big3", 42, 5400),
    ]);
    expect(report.clusters.map((c) => c.members.length)).toEqual([3, 2]);
  });
});
