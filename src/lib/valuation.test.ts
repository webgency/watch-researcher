import { describe, expect, it } from "vitest";
import { Watch } from "./types";
import { marketValueSummary } from "./valuation";

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
});
