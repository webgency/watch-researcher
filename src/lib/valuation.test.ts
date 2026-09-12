import { describe, expect, it } from "vitest";
import { Watch } from "./types";
import { normalizePriceToUsd } from "./scoring";
import {
  bestOffer,
  bestOfferTargetStatus,
  dealScore,
  freshnessForAge,
  marketValueSummary,
  trackedAskCondition,
} from "./valuation";

const watch: Watch = {
  id: "w1",
  brand: "Test",
  model: "Watch",
  status: "wishlist",
  price: { amount: 999, currency: "USD" },
  links: [],
  specs: {},
  tags: [],
  dateAdded: "2026-01-01",
};

describe("marketValueSummary", () => {
  it("withholds an estimate until two independent dated sources exist", () => {
    const summary = marketValueSummary({
      ...watch,
      links: [{
        url: "https://shop.example/watch",
        price: { amount: 800, currency: "USD" },
        condition: "new",
        observedAt: "2026-08-20",
      }],
    }, "new", new Date("2026-09-05"));

    expect(summary.confidence).toBe("insufficient");
    expect(summary.medianUsd).toBeUndefined();
  });

  it("calculates a condition-matched median and range", () => {
    const summary = marketValueSummary({
      ...watch,
      links: [
        { url: "https://a.example/watch", price: { amount: 800, currency: "USD" }, condition: "new", observedAt: "2026-08-20" },
        { url: "https://b.example/watch", price: { amount: 1000, currency: "USD" }, condition: "new", observedAt: "2026-08-21" },
        { url: "https://c.example/watch", price: { amount: 500, currency: "USD" }, condition: "pre-owned", observedAt: "2026-08-22" },
      ],
    }, "new", new Date("2026-09-05"));

    expect(summary).toMatchObject({ confidence: "low", medianUsd: 900, lowUsd: 800, highUsd: 1000 });
    expect(summary.observations).toHaveLength(2);
  });

  it("deduplicates the same retailer and keeps its newest observation", () => {
    const summary = marketValueSummary({
      ...watch,
      links: [
        { url: "https://a.example/old", price: { amount: 700, currency: "USD" }, condition: "new", observedAt: "2026-08-01" },
        { url: "https://a.example/new", price: { amount: 750, currency: "USD" }, condition: "new", observedAt: "2026-08-20" },
        { url: "https://b.example/watch", price: { amount: 900, currency: "USD" }, condition: "new", observedAt: "2026-08-20" },
      ],
    }, "new", new Date("2026-09-05"));

    expect(summary.observations.map((item) => item.priceUsd)).toEqual([750, 900]);
  });

  it("marks a median by the oldest evidence it includes", () => {
    const summary = marketValueSummary({
      ...watch,
      links: [
        { url: "https://a.example/watch", price: { amount: 800, currency: "USD" }, condition: "new", observedAt: "2026-09-01" },
        { url: "https://b.example/watch", price: { amount: 900, currency: "USD" }, condition: "new", observedAt: "2026-05-01" },
      ],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(summary.freshness).toBe("expired");
    expect(summary.observations.map((item) => item.freshness)).toEqual(["aging", "expired"]);
  });
});

describe("freshnessForAge", () => {
  it.each([
    [0, "fresh"],
    [7, "fresh"],
    [8, "aging"],
    [30, "aging"],
    [31, "stale"],
    [90, "stale"],
    [91, "expired"],
  ] as const)("maps %i days to %s", (days, tier) => {
    expect(freshnessForAge(days)).toBe(tier);
  });
});

describe("bestOffer", () => {
  it("prefers the tracked condition before price", () => {
    const result = bestOffer({
      ...watch,
      links: [
        { url: "https://new.example/watch", retailer: "New Shop", price: { amount: 900, currency: "USD" }, condition: "new", observedAt: "2026-09-08" },
        { url: "https://used.example/watch", price: { amount: 500, currency: "USD" }, condition: "pre-owned", observedAt: "2026-09-09" },
      ],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result).toMatchObject({
      status: "available",
      conditionMatch: "matched",
      usedConditionFallback: false,
      offer: { source: "New Shop", condition: "new", priceUsd: 900, ageDays: 2, freshness: "fresh" },
    });
  });

  it("uses and labels the other condition only when no match exists", () => {
    const result = bestOffer({
      ...watch,
      links: [
        { url: "https://used-a.example/watch", price: { amount: 700, currency: "USD" }, condition: "pre-owned", observedAt: "2026-08-01" },
        { url: "https://used-b.example/watch", price: { amount: 650, currency: "USD" }, condition: "pre-owned", observedAt: "2026-09-01" },
      ],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result).toMatchObject({
      status: "available",
      conditionMatch: "fallback",
      usedConditionFallback: true,
      offer: { price: { amount: 650, currency: "USD" }, condition: "pre-owned", ageDays: 9, freshness: "aging" },
    });
  });

  it("labels a winning offer whose condition was not recorded", () => {
    const result = bestOffer({
      ...watch,
      links: [{ url: "https://unknown.example/watch", price: { amount: 600, currency: "USD" }, observedAt: "2026-09-10" }],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result).toMatchObject({ status: "available", conditionMatch: "unknown", usedConditionFallback: false });
    if (result.status === "available") expect(result.offer.condition).toBeUndefined();
  });

  it("normalizes currencies for ranking but preserves the retailer currency", () => {
    const euros = { amount: 500, currency: "EUR" };
    const result = bestOffer({
      ...watch,
      links: [
        { url: "https://eu.example/watch", price: euros, condition: "new", observedAt: "2026-09-09" },
        { url: "https://us.example/watch", price: { amount: 700, currency: "USD" }, condition: "new", observedAt: "2026-09-09" },
      ],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.offer.price).toEqual(euros);
      expect(result.offer.priceUsd).toBeCloseTo(normalizePriceToUsd(euros));
    }
  });

  it("excludes undated offers and never substitutes the headline price", () => {
    const result = bestOffer({
      ...watch,
      price: { amount: 400, currency: "USD" },
      links: [{ url: "https://undated.example/watch", price: { amount: 350, currency: "USD" }, condition: "new" }],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result).toEqual({
      status: "insufficient",
      reason: "no-dated-offers",
      preferredCondition: "new",
      undatedOfferCount: 1,
    });
  });

  it("breaks equal-price ties in favor of the newer observation", () => {
    const result = bestOffer({
      ...watch,
      links: [
        { url: "https://old.example/watch", price: { amount: 600, currency: "USD" }, condition: "new", observedAt: "2026-08-01" },
        { url: "https://new.example/watch", price: { amount: 600, currency: "USD" }, condition: "new", observedAt: "2026-09-09" },
      ],
    }, "new", new Date("2026-09-10T12:00:00Z"));

    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.offer.url).toContain("new.example");
  });
});

describe("bestOfferTargetStatus", () => {
  it("does not attribute a watch-level landed cost to a retailer offer", () => {
    const candidate = {
      ...watch,
      price: { amount: 500, currency: "USD" },
      landedPrice: { amount: 600, currency: "USD" },
      targetPrice: { amount: 550, currency: "USD" },
      links: [{ url: "https://shop.example/watch", price: { amount: 500, currency: "USD" }, condition: "new" as const, observedAt: "2026-09-09" }],
    };
    const result = bestOffer(candidate, "new", new Date("2026-09-10T12:00:00Z"));

    expect(bestOfferTargetStatus(candidate, result)).toMatchObject({ basis: "listed", comparisonUsd: 500, met: true });
  });

  it("labels a different retailer offer as listed-price only", () => {
    const candidate = {
      ...watch,
      targetPrice: { amount: 450, currency: "USD" },
      links: [{ url: "https://shop.example/watch", price: { amount: 400, currency: "USD" }, condition: "new" as const, observedAt: "2026-09-09" }],
    };
    const result = bestOffer(candidate, "new", new Date("2026-09-10T12:00:00Z"));

    expect(bestOfferTargetStatus(candidate, result)).toMatchObject({ basis: "listed", comparisonUsd: 400, met: true });
  });
});

describe("dealScore", () => {
  it("shows insufficient evidence and no precise discount with fewer than two sources", () => {
    const result = dealScore({
      ...watch,
      links: [{
        url: "https://one.example/watch",
        price: { amount: 1100, currency: "USD" },
        condition: "new",
        observedAt: "2026-08-20",
      }],
    }, "new", new Date("2026-09-05"));

    expect(result).toMatchObject({
      status: "insufficient",
      reason: "fewer-than-two-sources",
      observationCount: 1,
      confidence: "insufficient",
    });
    expect(result.discountPct).toBeUndefined();
    expect(result.fairMedianUsd).toBeUndefined();
  });

  it("compares the landed ask with the independent condition-matched median", () => {
    const result = dealScore({
      ...watch,
      landedPrice: { amount: 850, currency: "USD" },
      links: [
        { url: "https://a.example/watch", price: { amount: 1000, currency: "USD" }, condition: "new", observedAt: "2026-08-20" },
        { url: "https://b.example/watch", price: { amount: 1200, currency: "USD" }, condition: "new", observedAt: "2026-08-25" },
      ],
    }, "new", new Date("2026-09-05"));

    expect(result).toMatchObject({
      status: "available",
      askUsd: 850,
      askKind: "landed",
      evidenceCondition: "new",
      fairLowUsd: 1000,
      fairMedianUsd: 1100,
      fairHighUsd: 1200,
      observationCount: 2,
      observationAgesDays: [11, 16],
      confidence: "low",
      usedConditionFallback: false,
      freshness: "aging",
    });
    expect(result.discountPct).toBeCloseTo(22.727);
    expect(result.ratioToMedian).toBeCloseTo(850 / 1100);
    // The headline $999 ask is not injected as a third market observation.
    expect(result.observations).toHaveLength(2);
  });

  it("prefers inferred matching-condition evidence", () => {
    const candidate = {
      ...watch,
      price: { amount: 700, currency: "USD" },
      links: [
        { url: "https://tracked.example/watch", price: { amount: 700, currency: "USD" }, condition: "pre-owned" as const, observedAt: "2026-09-01" },
        { url: "https://used-b.example/watch", price: { amount: 800, currency: "USD" }, condition: "pre-owned" as const, observedAt: "2026-08-25" },
        { url: "https://new-a.example/watch", price: { amount: 1200, currency: "USD" }, condition: "new" as const, observedAt: "2026-08-25" },
        { url: "https://new-b.example/watch", price: { amount: 1300, currency: "USD" }, condition: "new" as const, observedAt: "2026-08-25" },
      ],
    };

    expect(trackedAskCondition(candidate)).toBe("pre-owned");
    expect(dealScore(candidate, undefined, new Date("2026-09-05"))).toMatchObject({
      preferredCondition: "pre-owned",
      evidenceCondition: "pre-owned",
      usedConditionFallback: false,
      fairMedianUsd: 750,
    });
  });

  it("uses but clearly marks the other condition when only it has enough evidence", () => {
    const result = dealScore({
      ...watch,
      links: [
        { url: "https://used.example/watch", price: { amount: 700, currency: "USD" }, condition: "pre-owned", observedAt: "2026-09-01" },
        { url: "https://new-a.example/watch", price: { amount: 1100, currency: "USD" }, condition: "new", observedAt: "2026-08-25" },
        { url: "https://new-b.example/watch", price: { amount: 1300, currency: "USD" }, condition: "new", observedAt: "2026-08-25" },
      ],
    }, "pre-owned", new Date("2026-09-05"));

    expect(result).toMatchObject({
      status: "available",
      preferredCondition: "pre-owned",
      evidenceCondition: "new",
      usedConditionFallback: true,
      fairMedianUsd: 1200,
      observationCount: 2,
    });
  });

  it("withholds the comparison when no tracked or landed ask exists", () => {
    const result = dealScore({
      ...watch,
      price: undefined,
      links: [
        { url: "https://a.example/watch", price: { amount: 1000, currency: "USD" }, condition: "new", observedAt: "2026-08-20" },
        { url: "https://b.example/watch", price: { amount: 1200, currency: "USD" }, condition: "new", observedAt: "2026-08-25" },
      ],
    }, "new", new Date("2026-09-05"));

    expect(result).toMatchObject({ status: "insufficient", reason: "missing-ask", fairMedianUsd: 1100 });
    expect(result.discountPct).toBeUndefined();
  });
});
