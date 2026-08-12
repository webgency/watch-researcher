import { describe, expect, it } from "vitest";

import {
  caliberTier,
  computeStanding,
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

  it("scores caseCraft and bracelet only once qualityFlags exist", () => {
    const bare = makeWatch();
    expect(scoreDimensions(bare).caseCraft).toBeUndefined();
    expect(scoreDimensions(bare).bracelet).toBeUndefined();

    const flagged = makeWatch({
      qualityFlags: { braceletIncluded: true, microAdjustClasp: true, quickRelease: true },
    });
    const raw = scoreDimensions(flagged);
    expect(raw.bracelet).toBe(1);
    expect(raw.caseCraft).toBeCloseTo(0.35);
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
