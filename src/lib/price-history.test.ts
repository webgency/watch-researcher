import { describe, expect, it } from "vitest";
import {
  appendSnapshot,
  latestSnapshot,
  lowestSnapshot,
  priceMovement,
  sameMoney,
  targetStatus,
  watchesAtTarget,
} from "./price-history";
import { CURRENCY_TO_USD } from "./scoring";
import { Money, PriceSnapshot, Watch } from "./types";

const usd = (amount: number): Money => ({ amount, currency: "USD" });

function watch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: "w1",
    brand: "Test",
    model: "Model",
    status: "wishlist",
    links: [],
    specs: {},
    tags: [],
    dateAdded: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function snapshot(amount: number, date: string, currency = "USD"): PriceSnapshot {
  return { price: { amount, currency }, date };
}

describe("sameMoney", () => {
  it("compares amount and currency, ignoring case and padding", () => {
    expect(sameMoney(usd(100), { amount: 100, currency: " usd " })).toBe(true);
    expect(sameMoney(usd(100), usd(101))).toBe(false);
    expect(sameMoney(usd(100), { amount: 100, currency: "EUR" })).toBe(false);
  });

  it("treats a missing side as not equal", () => {
    expect(sameMoney(undefined, usd(100))).toBe(false);
    expect(sameMoney(undefined, undefined)).toBe(false);
  });
});

describe("appendSnapshot", () => {
  it("records the first observation", () => {
    const history = appendSnapshot(undefined, usd(500), "2026-01-01T00:00:00Z", "manual");
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ price: usd(500), date: "2026-01-01T00:00:00Z", source: "manual" });
  });

  it("appends when the price moves", () => {
    const first = appendSnapshot(undefined, usd(500), "2026-01-01T00:00:00Z");
    const second = appendSnapshot(first, usd(450), "2026-02-01T00:00:00Z");
    expect(second.map((s) => s.price.amount)).toEqual([500, 450]);
  });

  it("is a no-op when the price is unchanged, preserving the original date", () => {
    const first = appendSnapshot(undefined, usd(500), "2026-01-01T00:00:00Z");
    const second = appendSnapshot(first, usd(500), "2026-06-01T00:00:00Z");
    // Same reference: callers use identity to decide whether a write is needed.
    expect(second).toBe(first);
    expect(second[0].date).toBe("2026-01-01T00:00:00Z");
  });

  it("appends when only the currency changes", () => {
    const first = appendSnapshot(undefined, usd(500), "2026-01-01T00:00:00Z");
    const second = appendSnapshot(first, { amount: 500, currency: "EUR" }, "2026-02-01T00:00:00Z");
    expect(second).toHaveLength(2);
  });

  it("omits source when not supplied", () => {
    const history = appendSnapshot(undefined, usd(500), "2026-01-01T00:00:00Z");
    expect(history[0]).not.toHaveProperty("source");
  });
});

describe("latestSnapshot", () => {
  it("returns the newest entry, or undefined for an empty series", () => {
    expect(latestSnapshot([snapshot(500, "2026-01-01"), snapshot(450, "2026-02-01")])?.price.amount).toBe(450);
    expect(latestSnapshot([])).toBeUndefined();
    expect(latestSnapshot(undefined)).toBeUndefined();
  });
});

describe("priceMovement", () => {
  it("needs at least two snapshots", () => {
    expect(priceMovement([snapshot(500, "2026-01-01")])).toBeUndefined();
    expect(priceMovement(undefined)).toBeUndefined();
  });

  it("reports a drop as a negative delta", () => {
    const movement = priceMovement([snapshot(500, "2026-01-01"), snapshot(450, "2026-02-01")]);
    expect(movement?.deltaUsd).toBe(-50);
    expect(movement?.deltaPct).toBeCloseTo(-0.1);
  });

  it("compares the last two entries only", () => {
    const movement = priceMovement([
      snapshot(800, "2026-01-01"),
      snapshot(500, "2026-02-01"),
      snapshot(600, "2026-03-01"),
    ]);
    expect(movement?.previous.price.amount).toBe(500);
    expect(movement?.deltaUsd).toBe(100);
  });

  it("normalizes currencies before comparing", () => {
    // 500 EUR converts to more than 500 USD, so against a 520 USD prior this is
    // a rise, not the fall the raw numbers suggest. Derived from the rate table
    // rather than hardcoded, so refreshing rates does not break the test.
    const eurInUsd = 500 * CURRENCY_TO_USD.EUR;
    const movement = priceMovement([snapshot(520, "2026-01-01"), snapshot(500, "2026-02-01", "EUR")]);
    expect(movement?.deltaUsd).toBeCloseTo(eurInUsd - 520);
    expect(movement!.deltaUsd).toBeGreaterThan(0);
  });
});

describe("lowestSnapshot", () => {
  it("finds the cheapest entry by normalized price", () => {
    const history = [snapshot(800, "2026-01-01"), snapshot(450, "2026-02-01"), snapshot(600, "2026-03-01")];
    expect(lowestSnapshot(history)?.price.amount).toBe(450);
  });

  it("returns undefined for an empty series", () => {
    expect(lowestSnapshot([])).toBeUndefined();
  });
});

describe("targetStatus", () => {
  it("is undefined without a target", () => {
    expect(targetStatus(watch({ price: usd(500) }))).toBeUndefined();
  });

  it("is undefined without a price to compare", () => {
    expect(targetStatus(watch({ targetPrice: usd(400) }))).toBeUndefined();
  });

  it("reports a met target with no gap", () => {
    const status = targetStatus(watch({ price: usd(380), targetPrice: usd(400) }));
    expect(status?.met).toBe(true);
    expect(status?.gapUsd).toBe(0);
    expect(status?.gapPct).toBe(0);
  });

  it("treats exactly on target as met", () => {
    expect(targetStatus(watch({ price: usd(400), targetPrice: usd(400) }))?.met).toBe(true);
  });

  it("reports the overage when above target", () => {
    const status = targetStatus(watch({ price: usd(500), targetPrice: usd(400) }));
    expect(status?.met).toBe(false);
    expect(status?.gapUsd).toBe(100);
    expect(status?.gapPct).toBeCloseTo(0.25);
  });

  it("compares against landedPrice when set, not the sticker", () => {
    // Sticker is under target, but the all-in cost is not.
    const status = targetStatus(
      watch({ price: usd(390), landedPrice: usd(460), targetPrice: usd(400) })
    );
    expect(status?.met).toBe(false);
    expect(status?.currentUsd).toBe(460);
  });

  it("normalizes currencies on both sides", () => {
    // 300 EUR converts to comfortably under a 400 USD target at any plausible
    // rate. Asserted against the table so a rate refresh cannot flip the case.
    const status = targetStatus(
      watch({ price: { amount: 300, currency: "EUR" }, targetPrice: usd(400) })
    );
    expect(status?.currentUsd).toBeCloseTo(300 * CURRENCY_TO_USD.EUR);
    expect(status?.met).toBe(true);
  });
});

describe("watchesAtTarget", () => {
  it("returns only watches at or below target", () => {
    const met = watch({ id: "a", price: usd(300), targetPrice: usd(400) });
    const over = watch({ id: "b", price: usd(500), targetPrice: usd(400) });
    const untargeted = watch({ id: "c", price: usd(100) });
    expect(watchesAtTarget([met, over, untargeted]).map((w) => w.id)).toEqual(["a"]);
  });
});
