import { describe, expect, it } from "vitest";

import {
  assignQuadrant,
  caliberTier,
  computeDesignScore,
  computeStanding,
  medianScore,
  deriveCategory,
  derivePeerGroup,
  percentile,
  scoreDimensions,
  scoreDimensionEvidence,
  confidenceFor,
  CURRENCY_TO_USD,
  landedPriceUsd,
  normalizePriceToUsd,
} from "./scoring";
import { DIMENSIONS } from "./rubrics";
import { CURRENCIES } from "./types";
import {
  RATES_AS_OF,
  RATES_STALE_AFTER_DAYS,
  ratesAgeDays,
  ratesAreStale,
} from "./currency-rates.mjs";
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

  it("recognizes every caliber family currently represented in the collection", () => {
    const currentAliases = [
      "ETA (Peseux) 7001, elaboré grade",
      "Seiko/TMI NE86",
      "ALB01 A",
      "Seagull ST1721",
      "OT.G102",
      "Seiko Instruments (SII/TMI) NE88",
      "Miyota 9100",
      "FC-206",
      "Miyota 8215",
    ];
    expect(currentAliases.filter((caliber) => caliberTier(caliber) === undefined)).toEqual([]);
  });

  it("matches a base caliber through a brand's own designation", () => {
    // Brands rename the movements they buy, so the tier has to survive the
    // house name wrapped around the base caliber.
    expect(caliberTier("Laventure Caliber 3 (Sellita SW330-2)")).toBe(0.65);
    expect(caliberTier("Sellita SW330-2")).toBe(0.65);
    // SW330 must not be picked up by the SW300 pattern, or vice versa.
    expect(caliberTier("Sellita SW300-1")).toBe(0.65);
  });

  it("propagates a missing thickness as no wearability score, not a bad one", () => {
    const watch = makeWatch({ specs: { caseDiameterMm: 40 } });
    expect(scoreDimensions(watch).wearability).toBeUndefined();
  });

  it("keeps the 40mm wearability anchor where the old thickness/diameter ratio put it", () => {
    // Every rubric reference was tuned against a formula where 40x12.4 was par.
    // Moving that anchor would silently recalibrate all four category tables.
    const wearability = (d: number, t: number) =>
      scoreDimensions(makeWatch({ specs: { caseDiameterMm: d, caseThicknessMm: t } })).wearability;
    expect(wearability(40, 12.4)).toBeCloseTo(0.5, 5);
    expect(wearability(40, 10.4)).toBeCloseTo(1, 5);
    expect(wearability(40, 14.4)).toBeCloseTo(0, 5);
  });

  it("does not bottom out a small case for height it cannot avoid", () => {
    // A movement, crystal and caseback are a near-fixed stack, so a bare
    // thickness/diameter ratio charges narrow cases for millimetres that do not
    // scale down. A 37x11.6 is a well proportioned watch and must beat a 44x13
    // slab; under the ratio it scored 0.46 against that slab's 0.65.
    const wearability = (d: number, t: number) =>
      scoreDimensions(makeWatch({ specs: { caseDiameterMm: d, caseThicknessMm: t } })).wearability!;
    expect(wearability(37, 11.6)).toBeGreaterThan(wearability(44, 13));
    // Genuinely thick still reads as thick — this fixes the slope, not the floor.
    expect(wearability(37, 13.8)).toBeLessThan(0.1);
    expect(wearability(41, 16)).toBe(0);
  });

  it("scores caseCraft and bracelet only once their own qualityFlags exist", () => {
    const bare = makeWatch();
    expect(scoreDimensions(bare).caseCraft).toBeUndefined();
    expect(scoreDimensions(bare).bracelet).toBeUndefined();

    const flagged = makeWatch({
      qualityFlags: { braceletIncluded: true, microAdjustClasp: true, quickRelease: true },
    });
    const raw = scoreDimensions(flagged);
    expect(raw.bracelet).toBe(1);
    // Bracelet hardware says nothing about case finishing, so caseCraft stays
    // unrated rather than dropping to its 0.35 base.
    expect(raw.caseCraft).toBeUndefined();
  });

  it("leaves caseCraft unrated when only unrelated flags are recorded", () => {
    const watch = makeWatch({ qualityFlags: { accuracySpecSpd: 40 } });
    expect(scoreDimensions(watch).caseCraft).toBeUndefined();
    expect(scoreDimensions(watch).bracelet).toBeUndefined();
  });

  it("rates caseCraft from any one of its own flags, and bracelet independently", () => {
    const watch = makeWatch({ qualityFlags: { drilledLugs: true } });
    const raw = scoreDimensions(watch);
    expect(raw.caseCraft).toBeCloseTo(0.45);
    expect(raw.bracelet).toBeUndefined();
  });

  it("leaves bracelet unrated for a watch sold on a strap", () => {
    const watch = makeWatch({ qualityFlags: { braceletIncluded: false } });
    expect(scoreDimensions(watch).bracelet).toBeUndefined();
  });

  it("still rates bracelet when one is included", () => {
    const watch = makeWatch({ qualityFlags: { braceletIncluded: true, quickRelease: true } });
    expect(scoreDimensions(watch).bracelet).toBeCloseTo(0.65);
  });

  it("tracks missing sub-inputs as lower evidence rather than recorded failures", () => {
    const partial = makeWatch({ qualityFlags: { drilledLugs: true } });
    const moreCertain = makeWatch({ qualityFlags: { drilledLugs: true, sapphireBezelInsert: false } });
    const partialEvidence = scoreDimensionEvidence(partial).caseCraft!;
    const certainEvidence = scoreDimensionEvidence(moreCertain).caseCraft!;

    // Recording an absent feature does not retroactively lower the verified
    // capability score, but it does make the evidence more complete.
    expect(certainEvidence.raw).toBe(partialEvidence.raw);
    expect(partialEvidence.coverage).toBe(0.25);
    expect(certainEvidence.coverage).toBe(0.5);
  });

  it("reports durability coverage separately from its verified score", () => {
    const watch = makeWatch({
      scoringCategory: "diver",
      specs: { waterResistanceM: 200, crystal: "Sapphire" },
    });
    const durability = scoreDimensionEvidence(watch).durability!;
    expect(durability.raw).toBe(0.75);
    expect(durability.knownInputs).toBe(2);
    expect(durability.totalInputs).toBe(3);
    expect(durability.coverage).toBeCloseTo(2 / 3);
  });

  it("excludes an unrated bracelet from the composite rather than scoring it 0", () => {
    const strap = makeWatch({
      specs: { caliber: "NH35", waterResistanceM: 200, crystal: "Sapphire" },
      qualityFlags: { braceletIncluded: false, drilledLugs: true },
      tags: ["diver"],
      price: { amount: 400, currency: "USD" },
    });
    const standing = computeStanding(strap, [strap]);
    expect(standing.unrated).toContain("bracelet");
    expect(standing.dimensions.bracelet).toBeUndefined();
  });

  it("judges water resistance against the category expectation, not raw maximums", () => {
    const dress = makeWatch({ specs: { waterResistanceM: 50, crystal: "Sapphire" }, tags: ["dress"] });
    const diver = makeWatch({ specs: { waterResistanceM: 50, crystal: "Sapphire" }, tags: ["diver"] });
    expect(scoreDimensions(dress).durability!).toBeGreaterThan(scoreDimensions(diver).durability!);
  });
});

describe("category and peer group derivation", () => {
  it("leaves an unclassified watch without a rubric instead of silently using dress", () => {
    const watch = makeWatch({
      price: { amount: 700, currency: "USD" },
      specs: { caliber: "Seiko NH35", caseDiameterMm: 40, caseThicknessMm: 12 },
    });
    expect(deriveCategory(watch)).toBeUndefined();

    const standing = computeStanding(watch, [watch]);
    expect(standing.peerLabel).toBe("category unrated, $500-1000");
    expect(standing.qualityScore).toBeDefined();
    expect(standing.valueScore).toBeUndefined();
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

  it("requires an explicit category when legacy tags name different rubrics", () => {
    const hybrid = makeWatch({ tags: ["GMT", "diver"] });
    expect(deriveCategory(hybrid)).toBeUndefined();
    expect(deriveCategory({ ...hybrid, scoringCategory: "gmt" })).toBe("gmt");
  });

  it("accepts the legacy dive tag without treating every unknown tag as dress", () => {
    expect(deriveCategory(makeWatch({ tags: ["dive"] }))).toBe("diver");
    expect(deriveCategory(makeWatch({ tags: ["field"] }))).toBeUndefined();
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

describe("evidence confidence", () => {
  it("uses stable low, medium, and high thresholds", () => {
    expect(confidenceFor(0.49)).toBe("low");
    expect(confidenceFor(0.5)).toBe("medium");
    expect(confidenceFor(0.79)).toBe("medium");
    expect(confidenceFor(0.8)).toBe("high");
  });

  it("excludes a known strap-only bracelet from overall evidence coverage", () => {
    const watch = makeWatch({ qualityFlags: { braceletIncluded: false } });
    expect(computeStanding(watch, [watch]).evidenceCoverage).toBe(0);
  });
});

describe("design score", () => {
  it("rescales the 1-5 rank onto 0-100", () => {
    expect(computeDesignScore(makeWatch({ designUniqueness: 1 }))).toBe(0);
    expect(computeDesignScore(makeWatch({ designUniqueness: 3 }))).toBe(50);
    expect(computeDesignScore(makeWatch({ designUniqueness: 5 }))).toBe(100);
  });

  it("returns null for an unranked watch rather than a neutral middle", () => {
    // A neutral fill would park every unranked watch on the median line and
    // read as an opinion that was never given.
    expect(computeDesignScore(makeWatch())).toBeNull();
  });

  it("rejects out-of-range and non-integer ranks", () => {
    expect(computeDesignScore(makeWatch({ designUniqueness: 0 }))).toBeNull();
    expect(computeDesignScore(makeWatch({ designUniqueness: 6 }))).toBeNull();
    expect(computeDesignScore(makeWatch({ designUniqueness: 3.5 }))).toBeNull();
  });

  it("ignores the wishlist tier, which the matrix exists to inform", () => {
    const mustHave = makeWatch({ wishlistTier: "must-have" });
    const pass = makeWatch({ wishlistTier: "pass" });
    expect(computeDesignScore(mustHave)).toBe(computeDesignScore(pass));
  });
});

describe("medianScore", () => {
  it("returns null for an empty set so callers can choose their own fallback", () => {
    expect(medianScore([])).toBeNull();
  });

  it("averages the middle pair for an even count", () => {
    expect(medianScore([0, 25, 75, 100])).toBe(50);
    expect(medianScore([100, 0, 50])).toBe(50);
  });
});

describe("assignQuadrant", () => {
  const thresholds = { value: 50, design: 50 };

  it("places a watch by both axes", () => {
    expect(assignQuadrant(60, 60, thresholds)).toBe("buy");
    expect(assignQuadrant(40, 60, thresholds)).toBe("aspirational");
    expect(assignQuadrant(60, 40, thresholds)).toBe("sensible");
    expect(assignQuadrant(40, 40, thresholds)).toBe("skip");
  });

  it("gives no quadrant when either axis is missing", () => {
    expect(assignQuadrant(null, 60, thresholds)).toBeNull();
    expect(assignQuadrant(60, null, thresholds)).toBeNull();
  });
});

describe("currency conversion", () => {
  // The entry form offers every code in CURRENCIES. Any one missing from the
  // rate table falls back to 1.0, which silently scores 3000 SEK as $3000 and
  // lands the watch several price bands too high.
  it("has a rate for every currency the form offers", () => {
    const missing = CURRENCIES.filter((code) => CURRENCY_TO_USD[code] === undefined);
    expect(missing).toEqual([]);
  });

  it("has no rate that is implausibly far from 1, except JPY-like minor units", () => {
    for (const [code, rate] of Object.entries(CURRENCY_TO_USD)) {
      expect(rate, `${code} rate`).toBeGreaterThan(0);
      expect(rate, `${code} rate`).toBeLessThan(10);
    }
  });

  it("converts a foreign amount using the table", () => {
    const usd = normalizePriceToUsd({ amount: 100, currency: "EUR" });
    expect(usd).toBeCloseTo(100 * CURRENCY_TO_USD.EUR);
  });

  it("warns and passes the amount through for an unknown currency", () => {
    const warnings: string[] = [];
    const usd = normalizePriceToUsd({ amount: 100, currency: "XYZ" }, (m) => warnings.push(m));
    expect(usd).toBe(100);
    expect(warnings).toHaveLength(1);
  });

  it("normalizes case and padding before lookup", () => {
    expect(normalizePriceToUsd({ amount: 10, currency: " eur " })).toBeCloseTo(10 * CURRENCY_TO_USD.EUR);
  });

  it("orders watch prices by normalized landed cost rather than raw amounts", () => {
    const euros = makeWatch({ price: { amount: 900, currency: "EUR" } });
    const dollars = makeWatch({ price: { amount: 950, currency: "USD" } });
    expect(landedPriceUsd(euros)!).toBeGreaterThan(landedPriceUsd(dollars)!);

    const landed = makeWatch({
      price: { amount: 800, currency: "USD" },
      landedPrice: { amount: 1000, currency: "USD" },
    });
    expect(landedPriceUsd(landed)).toBe(1000);
  });
});

describe("rate staleness", () => {
  const asOf = new Date(`${RATES_AS_OF}T00:00:00Z`);
  const daysAfter = (n: number) => new Date(asOf.getTime() + n * 86_400_000);

  it("is zero days old on the day the rates were taken", () => {
    expect(ratesAgeDays(asOf)).toBe(0);
    expect(ratesAreStale(asOf)).toBe(false);
  });

  it("counts whole days elapsed", () => {
    expect(ratesAgeDays(daysAfter(45))).toBe(45);
  });

  it("is not stale on the threshold day itself", () => {
    expect(ratesAreStale(daysAfter(RATES_STALE_AFTER_DAYS))).toBe(false);
  });

  it("goes stale the day after the threshold", () => {
    expect(ratesAreStale(daysAfter(RATES_STALE_AFTER_DAYS + 1))).toBe(true);
  });

  it("reports a negative age rather than throwing if the date is in the future", () => {
    expect(ratesAgeDays(daysAfter(-10))).toBe(-10);
    expect(ratesAreStale(daysAfter(-10))).toBe(false);
  });
});
