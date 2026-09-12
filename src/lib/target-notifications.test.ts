import { describe, expect, it } from "vitest";
import { CURRENCY_TO_USD } from "./currency-rates.mjs";
import {
  detectTargetNotification,
  notificationKey,
  TARGET_NOTIFICATION_MAX_AGE_DAYS,
} from "./target-notifications.mjs";
import type { Watch } from "./types";

function watch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: "w1",
    brand: "Test",
    model: "Watch",
    status: "wishlist",
    links: [],
    specs: {},
    tags: [],
    dateAdded: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const now = new Date("2026-09-10T12:00:00Z");

describe("detectTargetNotification", () => {
  it("reports tracked and best-offer triggers with their provenance", () => {
    const result = detectTargetNotification(watch({
      price: { amount: 400, currency: "USD" },
      priceUpdatedAt: "2026-09-09T12:00:00Z",
      targetPrice: { amount: 450, currency: "USD" },
      links: [{
        url: "https://shop.example/watch",
        retailer: "Shop",
        price: { amount: 425, currency: "USD" },
        condition: "new",
        observedAt: "2026-09-08T12:00:00Z",
      }],
    }), { now });

    expect(result.status).toBe("actionable");
    expect(result.hits).toEqual([
      expect.objectContaining({ trigger: "tracked", basis: "tracked", ageDays: 1, freshness: "fresh", priceUsd: 400 }),
      expect.objectContaining({
        trigger: "best-offer",
        basis: "listed",
        source: "Shop",
        condition: "new",
        ageDays: 2,
        freshness: "fresh",
        url: "https://shop.example/watch",
      }),
    ]);
  });

  it("labels a landed-price trigger separately", () => {
    const result = detectTargetNotification(watch({
      price: { amount: 350, currency: "USD" },
      landedPrice: { amount: 390, currency: "USD" },
      priceUpdatedAt: "2026-09-09T12:00:00Z",
      targetPrice: { amount: 400, currency: "USD" },
    }), { now });

    expect(result.hits).toEqual([
      expect.objectContaining({ trigger: "landed", basis: "all-in", priceUsd: 390 }),
    ]);
  });

  it("normalizes currencies through the shared snapshot", () => {
    const result = detectTargetNotification(watch({
      price: { amount: 300, currency: "EUR" },
      priceUpdatedAt: "2026-09-09T12:00:00Z",
      targetPrice: { amount: 400, currency: "USD" },
    }), { now });

    expect(result.hits[0]).toMatchObject({ trigger: "tracked" });
    expect(result.hits[0].priceUsd).toBeCloseTo(300 * CURRENCY_TO_USD.EUR);
  });

  it("returns explicit reasons for missing target and missing evidence", () => {
    expect(detectTargetNotification(watch(), { now })).toMatchObject({
      status: "skipped",
      skipReasons: [{ code: "no-target" }],
    });

    const result = detectTargetNotification(watch({
      targetPrice: { amount: 400, currency: "USD" },
    }), { now });
    expect(result.skipReasons.map((item: { code: string }) => item.code)).toEqual([
      "missing-current-ask",
      "no-dated-offer",
    ]);
  });

  it("does not alert on undated evidence", () => {
    const result = detectTargetNotification(watch({
      price: { amount: 300, currency: "USD" },
      targetPrice: { amount: 400, currency: "USD" },
      links: [{ url: "https://shop.example/watch", price: { amount: 250, currency: "USD" }, condition: "new" }],
    }), { now });

    expect(result.status).toBe("skipped");
    expect(result.hits).toEqual([]);
    expect(result.skipReasons.map((item: { code: string }) => item.code)).toEqual([
      "undated-current-ask",
      "no-dated-offer",
    ]);
  });

  it("skips evidence beyond 90 days unless explicitly included", () => {
    expect(TARGET_NOTIFICATION_MAX_AGE_DAYS).toBe(90);
    const candidate = watch({
      price: { amount: 300, currency: "USD" },
      priceUpdatedAt: "2026-06-10T12:00:00Z",
      targetPrice: { amount: 400, currency: "USD" },
      links: [{
        url: "https://shop.example/watch",
        price: { amount: 250, currency: "USD" },
        condition: "new",
        observedAt: "2026-06-10T12:00:00Z",
      }],
    });

    const skipped = detectTargetNotification(candidate, { now });
    expect(skipped.status).toBe("skipped");
    expect(skipped.skipReasons.map((item: { code: string }) => item.code)).toEqual([
      "expired-current-ask",
      "expired-best-offer",
    ]);

    const included = detectTargetNotification(candidate, { now, includeStale: true });
    expect(included.hits.map((hit: { trigger: string }) => hit.trigger)).toEqual(["tracked", "best-offer"]);
    expect(included.hits.every((hit: { freshness: string }) => hit.freshness === "expired")).toBe(true);
  });

  it("reports above-target signals without notifying", () => {
    const result = detectTargetNotification(watch({
      price: { amount: 500, currency: "USD" },
      priceUpdatedAt: "2026-09-09T12:00:00Z",
      targetPrice: { amount: 400, currency: "USD" },
      links: [{
        url: "https://shop.example/watch",
        price: { amount: 450, currency: "USD" },
        observedAt: "2026-09-09T12:00:00Z",
      }],
    }), { now });

    expect(result.status).toBe("skipped");
    expect(result.skipReasons.map((item: { code: string }) => item.code)).toEqual([
      "current-ask-above-target",
      "best-offer-above-target",
    ]);
  });
});

describe("notificationKey", () => {
  it("deduplicates by watch, trigger, currency, and exact price", () => {
    const hit = { trigger: "best-offer", price: { amount: 399, currency: "usd" } };
    expect(notificationKey("w1", hit)).toBe("v1:w1:best-offer:USD:399");
    expect(notificationKey("w1", { ...hit, trigger: "tracked" })).not.toBe(notificationKey("w1", hit));
    expect(notificationKey("w1", { ...hit, price: { amount: 398, currency: "USD" } })).not.toBe(notificationKey("w1", hit));
  });
});
