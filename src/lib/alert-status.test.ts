import { describe, expect, it } from "vitest";
import { detectAlerts, emptyAlertState, setAlertTypeEnabled, setWatchMuted, type AlertState } from "./alerts.mjs";
import { watchAlertStatus } from "./alert-status";
import type { Watch } from "./types";

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const base: Watch = {
  id: "w", brand: "Fixture", model: "Watch", status: "wishlist", wishlistTier: "pass",
  price: { amount: 800, currency: "USD" }, specs: {}, tags: [], notes: "", dateAdded: "2026-01-01T00:00:00.000Z",
  links: [{ url: "https://a.example/w", retailer: "a.example", price: { amount: 800, currency: "USD" }, condition: "new", observedAt: daysAgo(40) }],
};
const byType = (watch: Watch, state: AlertState = emptyAlertState()) =>
  Object.fromEntries(watchAlertStatus(watch, state).types.map((status) => [status.type, status]));

/** Re-confirm the stale ask today: the write that could announce a fresh offer. */
function reconfirmed(watch: Watch): Watch {
  return { ...watch, links: watch.links.map((link) => ({ ...link, observedAt: now.toISOString() })) };
}

describe("watch alert status", () => {
  it("agrees with detectAlerts on the fresh-offer tier gate", () => {
    const below = byType(base).fresh_offer;
    expect(below).toMatchObject({ watching: false });
    expect(below.detail).toContain("marked Pass");
    expect(detectAlerts(base, reconfirmed(base), { now }).map((alert) => alert.type)).not.toContain("fresh_offer");

    for (const wishlistTier of ["shortlist", "watching", undefined] as const) {
      const watched = { ...base, wishlistTier };
      expect(byType(watched).fresh_offer.watching).toBe(true);
      expect(detectAlerts(watched, reconfirmed(watched), { now }).map((alert) => alert.type)).toContain("fresh_offer");
    }
  });
  it("does not watch fresh offers on an owned watch", () => {
    expect(byType({ ...base, status: "owned" }).fresh_offer.detail).toBe("Only for wishlist watches");
  });
  it("needs a target before watching target_met", () => {
    expect(byType(base).target_met).toMatchObject({ watching: false, detail: "No target set" });
    expect(byType({ ...base, targetPrice: { amount: 700, currency: "USD" } }).target_met.watching).toBe(true);
  });
  it("watches price drops only on priced listings", () => {
    expect(byType(base).price_drop.detail).toContain("1 listing ");
    expect(byType({ ...base, links: [{ url: "https://a.example/w" }] }).price_drop).toMatchObject({ watching: false });
  });
  it("reports a switched-off type and a muted watch without hiding the other reasons", () => {
    const off = setAlertTypeEnabled(emptyAlertState(), "price_drop", false);
    expect(byType(base, off).price_drop.detail).toContain("alert settings");

    const muted = setWatchMuted(emptyAlertState(), base.id, true);
    const status = watchAlertStatus({ ...base, targetPrice: { amount: 700, currency: "USD" } }, muted);
    expect(status.muted).toBe(true);
    expect(status.types.find((type) => type.type === "target_met")).toMatchObject({ watching: false, detail: "Paused while this watch is muted" });
    expect(status.types.find((type) => type.type === "fresh_offer")?.detail).toContain("marked Pass");
  });
  it("finds the newest alert for this watch", () => {
    const payload = { watch: "Fixture Watch", price: { amount: 700, currency: "USD" }, priceUsd: 700, asOf: now.toISOString() };
    const state: AlertState = {
      ...emptyAlertState(),
      events: [
        { id: "1", watchId: base.id, type: "price_drop", createdAt: daysAgo(5), payload },
        { id: "2", watchId: "other", type: "fresh_offer", createdAt: daysAgo(1), payload },
        { id: "3", watchId: base.id, type: "target_met", createdAt: daysAgo(2), payload },
      ],
    };
    expect(watchAlertStatus(base, state).lastEvent?.id).toBe("3");
  });
});
