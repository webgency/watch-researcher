import { describe, expect, it } from "vitest";

import {
  assignQuadrant,
  caliberTier,
  computeDesignScore,
  computeStanding,
  computeThresholds,
  deriveCategory,
  derivePeerGroup,
  percentile,
  scoreDimensions,
} from "./scoring";
import { DIMENSIONS } from "./rubrics";
import type { Watch } from "./types";

let nextId = 0;

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  nextId += 1;
  return {
    id: `test-${nextId}`,
    brand: "Testbrand",
    model: "Model",
    status: "wishlist",
    links: [],
    specs: {},
    tags: [],
    dateAdded: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("scoreDimensions", () => {
  it("returns no dimensions for a watch with missing specs", () => {
    const watch = makeWatch();
    expect(scoreDimensions(watch)).toEqual({});
  });

  it("leaves movement undefined for an unknown caliber instead of defaulting to a mid value", () => {
    const watch = makeWatch({
      specs: {
        caliber: "Frankenwerk FW-9000",
        caseDiameterMm: 40,
        caseThicknessMm: 12,
        waterResistanceM: 200,
        crystal: "Sapphire",
      },
      tags: ["diver"],
    });
    const raw = scoreDimensions(watch);
    expect(raw.movement).toBeUndefined();
    expect(caliberTier("Frankenwerk FW-9000")).toBeUndefined();
    // Other dimensions still score from their own data.
    expect(raw.wearability).toBeDefined();
    expect(raw.durability).toBeDefined();
  });

  it("recognizes calibers inside catalog phrasing", () => {
    expect(caliberTier("Automatic Cal. Miyota 9075 GMT")).toBe(0.62);
    expect(caliberTier("Seiko NH35")).toBe(0.3);
    expect(caliberTier(undefined)).toBeUndefined();
  });

  it("propagates a missing thickness as no wearability score, not a bad one", () => {
    const watch = makeWatch({ specs: { caseDiameterMm: 40 } });
    expect(scoreDimensions(watch).wearability).toBeUndefined();
  });

  it("leaves caseCraft and bracelet unrated when nothing evidences them", () => {
    const bare = makeWatch();
    expect(scoreDimensions(bare).caseCraft).toBeUndefined();
    expect(scoreDimensions(bare).bracelet).toBeUndefined();
  });

  it("rates the bracelet only for a watch that ships on one", () => {
    const onBracelet = makeWatch({
      qualityFlags: { braceletIncluded: true, microAdjustClasp: true, quickRelease: true },
    });
    expect(scoreDimensions(onBracelet).bracelet).toBe(1);

    // A strap watch has no bracelet to rate. Scoring it 0 here would surface as
    // "trails on bracelet" when the dimension simply does not apply.
    const onStrap = makeWatch({
      qualityFlags: { braceletIncluded: false, quickRelease: true },
    });
    expect(scoreDimensions(onStrap).bracelet).toBeUndefined();
  });

  it("needs clasp hardware before rating a bracelet it knows nothing else about", () => {
    // A bare braceletIncluded would otherwise score 0.40 — below every rubric
    // reference — purely because the clasp was never surveyed.
    const unsurveyed = makeWatch({ qualityFlags: { braceletIncluded: true } });
    expect(scoreDimensions(unsurveyed).bracelet).toBeUndefined();

    // An explicit negative is evidence, so it rates.
    const surveyed = makeWatch({
      qualityFlags: { braceletIncluded: true, microAdjustClasp: false, quickRelease: false },
    });
    expect(scoreDimensions(surveyed).bracelet).toBeCloseTo(0.4);
  });

  it("needs more than one recorded flag before rating caseCraft", () => {
    // The single most common record in the collection: a lone negative that
    // says nothing about finishing.
    const loneNegative = makeWatch({ qualityFlags: { sapphireBezelInsert: false } });
    expect(scoreDimensions(loneNegative).caseCraft).toBeUndefined();

    // Two recorded flags mean finishing was actually surveyed.
    const surveyed = makeWatch({
      qualityFlags: { sapphireBezelInsert: false, drilledLugs: true },
    });
    expect(scoreDimensions(surveyed).caseCraft).toBeCloseTo(0.45);
  });

  it("judges water resistance against the category expectation, not raw maximums", () => {
    const dress = makeWatch({ specs: { waterResistanceM: 50, crystal: "Sapphire" }, tags: ["dress"] });
    const diver = makeWatch({ specs: { waterResistanceM: 50, crystal: "Sapphire" }, tags: ["diver"] });
    expect(scoreDimensions(dress).durability!).toBeGreaterThan(scoreDimensions(diver).durability!);
  });
});

describe("category and peer group derivation", () => {
  it("falls back to dress for a watch with no tags and still produces a standing", () => {
    const watch = makeWatch({
      price: { amount: 700, currency: "USD" },
      specs: { caliber: "Seiko NH35", caseDiameterMm: 40, caseThicknessMm: 12 },
    });
    expect(deriveCategory(watch)).toBe("dress");

    const standing = computeStanding(watch, [watch]);
    expect(standing.peerLabel).toBe("dress, $500-1000");
    expect(standing.qualityScore).toBeDefined();
    expect(standing.unrated).toContain("durability");
  });

  it("maps recognized tags case-insensitively and groups by price band", () => {
    const gmt = makeWatch({ tags: ["GMT"], price: { amount: 900, currency: "USD" } });
    const sameBand = makeWatch({ tags: ["worldtimer"], price: { amount: 600, currency: "USD" } });
    const otherBand = makeWatch({ tags: ["GMT"], price: { amount: 2500, currency: "USD" } });
    const otherCategory = makeWatch({ tags: ["diver"], price: { amount: 900, currency: "USD" } });

    const group = derivePeerGroup(gmt, [gmt, sameBand, otherBand, otherCategory]);
    expect(group.label).toBe("GMTs, $500-1000");
    expect(group.members.map((member) => member.id)).toEqual([gmt.id, sameBand.id]);
  });

  it("prefers landedPrice over list price for banding", () => {
    const watch = makeWatch({
      tags: ["diver"],
      price: { amount: 950, currency: "USD" },
      landedPrice: { amount: 1150, currency: "USD" },
    });
    expect(derivePeerGroup(watch, [watch]).band?.id).toBe("1000-2000");
  });
});

describe("computeStanding", () => {
  it("handles a peer group of size 1 without a percentile", () => {
    const watch = makeWatch({
      tags: ["diver"],
      price: { amount: 800, currency: "USD" },
      specs: {
        caliber: "Seiko NH35",
        caseDiameterMm: 40,
        caseThicknessMm: 12,
        waterResistanceM: 200,
        crystal: "Sapphire",
      },
    });
    const standing = computeStanding(watch, [watch]);
    expect(standing.peerCount).toBe(1);
    expect(standing.qualityPercentile).toBeUndefined();
    expect(standing.qualityScore).toBeDefined();
    expect(standing.valueScore).toBeDefined();
  });

  it("marks all five dimensions unrated for an empty watch and fabricates no numbers", () => {
    const watch = makeWatch({ price: { amount: 300, currency: "USD" } });
    const standing = computeStanding(watch, [watch]);
    expect(standing.unrated).toEqual(DIMENSIONS);
    expect(standing.dimensions).toEqual({});
    expect(standing.qualityScore).toBeUndefined();
    expect(standing.valueScore).toBeUndefined();
    expect(standing.beats).toEqual([]);
    expect(standing.trails).toEqual([]);
  });

  it("excludes an unrated movement from the composite instead of scoring it 0.5", () => {
    const specs = {
      caseDiameterMm: 40,
      caseThicknessMm: 10,
      waterResistanceM: 200,
      crystal: "Sapphire",
    };
    const unknownCaliber = makeWatch({
      tags: ["diver"],
      price: { amount: 800, currency: "USD" },
      specs: { ...specs, caliber: "Mystery 1" },
    });
    const noCaliber = makeWatch({
      tags: ["diver"],
      price: { amount: 800, currency: "USD" },
      specs,
    });

    const a = computeStanding(unknownCaliber, [unknownCaliber]);
    const b = computeStanding(noCaliber, [noCaliber]);
    expect(a.unrated).toContain("movement");
    // Composite over the same rated dimensions -> identical score.
    expect(a.qualityScore).toBe(b.qualityScore);
  });

  it("never folds friction into any numeric score", () => {
    const base = {
      tags: ["diver"],
      price: { amount: 800, currency: "USD" },
      specs: {
        caliber: "Seiko NH35",
        caseDiameterMm: 40,
        caseThicknessMm: 12,
        waterResistanceM: 200,
        crystal: "Sapphire",
      },
    };
    const clean = makeWatch(base);
    const troubled = makeWatch({
      ...base,
      friction: {
        availability: "pre-order",
        expectedShipDate: "2026-11-01",
        braceletUpchargeUsd: 189,
        brandLiquidity: 1,
      },
    });

    const cleanStanding = computeStanding(clean, [clean]);
    const troubledStanding = computeStanding(troubled, [troubled]);
    expect(troubledStanding.qualityScore).toBe(cleanStanding.qualityScore);
    expect(troubledStanding.valueScore).toBe(cleanStanding.valueScore);
    expect(cleanStanding.frictions).toEqual([]);
    expect(troubledStanding.frictions).toEqual([
      "pre-order, ships 2026-11-01",
      "bracelet +$189",
      "thin secondary market",
    ]);
  });

  it("reports beats and trails against the band rubric", () => {
    // $500-1000 diver rubric: movement par 0.45, durability par 0.80.
    const watch = makeWatch({
      tags: ["diver"],
      price: { amount: 800, currency: "USD" },
      specs: { caliber: "Sellita SW510-M", waterResistanceM: 100, crystal: "mineral" },
    });
    const standing = computeStanding(watch, [watch]);
    expect(standing.beats).toContain("movement");
    expect(standing.trails).toContain("durability");
  });

  it("only reports a percentile once the peer group reaches six members", () => {
    const diverAt = (amount: number, thickness: number) =>
      makeWatch({
        tags: ["diver"],
        price: { amount, currency: "USD" },
        specs: {
          caliber: "Seiko NH35",
          caseDiameterMm: 40,
          caseThicknessMm: thickness,
          waterResistanceM: 200,
          crystal: "Sapphire",
        },
      });
    const group = [11, 12, 13, 14, 15, 16].map((thickness) => diverAt(700, thickness));

    const standing = computeStanding(group[0], group);
    expect(standing.peerCount).toBe(6);
    expect(standing.qualityPercentile).toBe(1);
    expect(computeStanding(group[5], group).qualityPercentile).toBe(0);
  });
});

describe("percentile", () => {
  it("returns undefined for pools smaller than six", () => {
    expect(percentile(0.5, [0.1, 0.2, 0.3, 0.4, 0.9])).toBeUndefined();
  });

  it("ranks within pools of six or more", () => {
    expect(percentile(0.5, [0.1, 0.2, 0.3, 0.4, 0.5, 0.9])).toBe(0.8);
  });
});

describe("computeDesignScore", () => {
  it("maps the 1-5 rank onto 0-100", () => {
    expect(computeDesignScore(makeWatch({ designUniqueness: 1 }))).toBe(0);
    expect(computeDesignScore(makeWatch({ designUniqueness: 3 }))).toBe(50);
    expect(computeDesignScore(makeWatch({ designUniqueness: 5 }))).toBe(100);
  });

  it("returns null for an unranked watch instead of a neutral middle", () => {
    // The whole point of the axis: an unranked watch carries no design
    // opinion, so it must not land on the median line as if it did.
    expect(computeDesignScore(makeWatch())).toBeNull();
    expect(computeDesignScore(makeWatch({ designUniqueness: 0 }))).toBeNull();
    expect(computeDesignScore(makeWatch({ designUniqueness: 6 }))).toBeNull();
    expect(computeDesignScore(makeWatch({ designUniqueness: 3.5 }))).toBeNull();
  });

  it("ignores the wishlist tier, which used to drive most of this axis", () => {
    const passed = makeWatch({ wishlistTier: "pass", designUniqueness: 5 });
    const mustHave = makeWatch({ wishlistTier: "must-have", designUniqueness: 5 });
    expect(computeDesignScore(passed)).toBe(computeDesignScore(mustHave));
  });
});

describe("quadrants with an unranked design axis", () => {
  it("assigns no quadrant when either axis is missing", () => {
    const thresholds = { value: 50, design: 50 };
    expect(assignQuadrant(80, null, thresholds)).toBeNull();
    expect(assignQuadrant(null, 80, thresholds)).toBeNull();
    expect(assignQuadrant(80, 80, thresholds)).toBe("buy");
    expect(assignQuadrant(20, 80, thresholds)).toBe("aspirational");
    expect(assignQuadrant(80, 20, thresholds)).toBe("sensible");
    expect(assignQuadrant(20, 20, thresholds)).toBe("skip");
  });

  it("takes each axis median from the watches scored on that axis", () => {
    // Four priced watches, only some of them ranked for design. The design
    // median must come from the ranked ones alone, not be dragged by nulls.
    const { thresholds, method } = computeThresholds([
      { valueScore: 10, designScore: 100 },
      { valueScore: 20, designScore: 100 },
      { valueScore: 30, designScore: null },
      { valueScore: 40, designScore: null },
    ]);
    expect(method).toBe("fixed");
    expect(thresholds.design).toBe(50);

    const full = computeThresholds([
      { valueScore: 10, designScore: 0 },
      { valueScore: 20, designScore: 25 },
      { valueScore: 30, designScore: 75 },
      { valueScore: 40, designScore: 100 },
    ]);
    expect(full.method).toBe("median");
    expect(full.thresholds.value).toBe(25);
    expect(full.thresholds.design).toBe(50);
  });
});
