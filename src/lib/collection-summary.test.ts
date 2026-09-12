import { describe, expect, it } from "vitest";
import { Watch } from "./types";
import { collectionSummary } from "./collection-summary";

const NOW = new Date("2026-09-12");

function watch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: "w1",
    brand: "Test",
    model: "Model",
    status: "wishlist",
    price: { amount: 1000, currency: "USD" },
    links: [],
    specs: {},
    tags: [],
    dateAdded: "2026-01-01",
    ...overrides,
  };
}

const offer = (url: string, observedAt: string) => ({
  url,
  price: { amount: 900, currency: "USD" },
  condition: "new" as const,
  observedAt,
});

describe("collectionSummary", () => {
  it("counts every watch as tracked, owned included", () => {
    const summary = collectionSummary(
      [watch({ id: "a" }), watch({ id: "b", status: "owned" })],
      NOW
    );
    expect(summary.tracked).toBe(2);
  });

  it("excludes owned watches from wishlist value", () => {
    const summary = collectionSummary(
      [
        watch({ id: "a", price: { amount: 1000, currency: "USD" } }),
        watch({ id: "b", price: { amount: 500, currency: "USD" } }),
        watch({ id: "c", status: "owned", price: { amount: 9000, currency: "USD" } }),
      ],
      NOW
    );
    expect(summary.wishlistValueUsd).toBe(1500);
  });

  it("treats a watch with no usable price as zero rather than skipping the rest", () => {
    const summary = collectionSummary(
      [watch({ id: "a", price: undefined }), watch({ id: "b", price: { amount: 400, currency: "USD" } })],
      NOW
    );
    expect(summary.wishlistValueUsd).toBe(400);
  });

  it("counts only watches whose best dated offer is still fresh", () => {
    const summary = collectionSummary(
      [
        watch({ id: "fresh", links: [offer("https://a.example/w", "2026-09-11")] }),
        watch({ id: "stale", links: [offer("https://b.example/w", "2025-01-01")] }),
        watch({ id: "undated", links: [{ url: "https://c.example/w", price: { amount: 900, currency: "USD" } }] }),
      ],
      NOW
    );
    expect(summary.freshOffers).toBe(1);
  });

  it("counts watches at or below target", () => {
    const summary = collectionSummary(
      [
        watch({ id: "met", price: { amount: 800, currency: "USD" }, targetPrice: { amount: 900, currency: "USD" } }),
        watch({ id: "over", price: { amount: 1200, currency: "USD" }, targetPrice: { amount: 900, currency: "USD" } }),
        watch({ id: "untargeted" }),
      ],
      NOW
    );
    expect(summary.atTarget).toBe(1);
  });

  it("reports zeroes for an empty collection instead of throwing", () => {
    expect(collectionSummary([], NOW)).toEqual({
      tracked: 0,
      freshOffers: 0,
      wishlistValueUsd: 0,
      atTarget: 0,
    });
  });
});
