import { describe, expect, it } from "vitest";
import { calibrationScore, continuousReference } from "./scoring-calibration";
import { DIMENSIONS, PRICE_ANCHORS_USD, PRICE_BANDS, RUBRIC_CATEGORIES, rubricFor } from "./rubrics";
import { Watch } from "./types";

const diver: Watch = {
  id: "d1",
  brand: "Test",
  model: "Diver",
  status: "wishlist",
  scoringCategory: "diver",
  price: { amount: 425, currency: "USD" },
  links: [],
  specs: { caseDiameterMm: 40, caseThicknessMm: 14.1, caliber: "Miyota 8215", waterResistanceM: 150, crystal: "Sapphire" },
  qualityFlags: { braceletIncluded: true },
  tags: ["diver"],
  dateAdded: "2026-01-01",
};

describe("scoring calibration", () => {
  it("changes every category and dimension smoothly across every display-band edge", () => {
    for (const edge of [500, 1000, 2000, 5000]) {
      for (const category of RUBRIC_CATEGORIES) {
        for (const dimension of DIMENSIONS) {
          const below = continuousReference(category, dimension, edge - 1);
          const above = continuousReference(category, dimension, edge + 1);
          expect(Math.abs(above - below)).toBeLessThan(0.002);
        }
      }
    }
  });

  it("preserves each established band rubric at its midpoint anchor", () => {
    for (const category of RUBRIC_CATEGORIES) {
      for (const [index, anchor] of PRICE_ANCHORS_USD.entries()) {
        for (const dimension of DIMENSIONS) {
          expect(continuousReference(category, dimension, anchor)).toBeCloseTo(
            rubricFor(category, PRICE_BANDS[index].id)[dimension],
            10
          );
        }
      }
    }
  });

  it("gives a diver thickness allowance without making it automatically excellent", () => {
    const result = calibrationScore(diver);
    expect(result.wearabilityScore).toBeCloseTo(0.325);
    expect(result.wearabilityScore).toBeLessThan(0.5);
  });

  it("keeps small price changes small in the experimental value score", () => {
    const at499 = calibrationScore({ ...diver, price: { amount: 499, currency: "USD" } }).valueScore!;
    const at501 = calibrationScore({ ...diver, price: { amount: 501, currency: "USD" } }).valueScore!;
    expect(Math.abs(at501 - at499)).toBeLessThan(0.002);
  });
});
