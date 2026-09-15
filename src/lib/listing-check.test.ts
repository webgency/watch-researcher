import { describe, expect, it } from "vitest";
import type { RetailerLink } from "./types";
import { listingCheckOutcome, todayInputDate } from "./listing-entry";

const link: RetailerLink = { url: "https://shop.example/watch", retailer: "shop.example", price: { amount: 800, currency: "USD" }, condition: "new", observedAt: "2026-09-10T12:00:00.000Z" };

describe("listing price check", () => {
  it("reports an unchanged ask so only the observation date can advance", () => {
    expect(listingCheckOutcome(link, { price: { amount: 800, currency: "usd" } })).toEqual({ kind: "unchanged", price: { amount: 800, currency: "USD" }, missingCondition: false });
  });
  it("reports a changed ask, and flags a currency switch", () => {
    expect(listingCheckOutcome(link, { price: { amount: 760, currency: "USD" } })).toMatchObject({ kind: "changed", currencyChanged: false });
    expect(listingCheckOutcome(link, { price: { amount: 800, currency: "EUR" } })).toMatchObject({ kind: "changed", currencyChanged: true });
  });
  it("finds no price rather than inventing one from a partial scrape", () => {
    expect(listingCheckOutcome(link, {})).toEqual({ kind: "no-price" });
    expect(listingCheckOutcome(link, { price: { amount: 0, currency: "USD" } })).toEqual({ kind: "no-price" });
    expect(listingCheckOutcome(link, { price: { amount: 700 } })).toEqual({ kind: "no-price" });
  });
  it("flags a listing with no recorded condition instead of taking one from the page", () => {
    expect(listingCheckOutcome({ ...link, condition: undefined },{ price: { amount: 800, currency: "USD" } })).toMatchObject({ kind: "unchanged", missingCondition: true });
  });
  it("formats today as the local calendar day a date input expects", () => {
    expect(todayInputDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
