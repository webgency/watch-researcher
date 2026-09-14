import { describe, expect, it } from "vitest";
import { listingEligibility, listingIdentity, parseListingFields } from "./listing-entry";
import { marketValueSummary } from "./valuation";
import type { RetailerLink, Watch } from "./types";

const fields = { url: "https://dealer.example/watch", amount: "100", currency: "USD", condition: "pre-owned", observedAt: "2026-09-13" };
const now = new Date("2026-09-14T12:00:00Z");
function link(source: string, date = "2026-09-13"): RetailerLink {
  return { url: `https://${source}.example/watch`, price: { amount: 100, currency: "USD" }, condition: "pre-owned", observedAt: date };
}

describe("focused listing input", () => {
  it("normalizes the source, money, and explicit calendar day, ignoring unrelated fields", () => {
    expect(parseListingFields({ ...fields, currency: "usd", brand: "Wrong", askHistory: [{}] })).toEqual({ ok: true, listing: { url: fields.url, retailer: "dealer.example", price: { amount: 100, currency: "USD" }, condition: "pre-owned", observedAt: "2026-09-13T12:00:00.000Z" } });
  });
  it("never fills a missing date or condition and provides field-level errors", () => {
    expect(parseListingFields({ ...fields, observedAt: "", condition: "" })).toMatchObject({ ok: false, errors: { observedAt: expect.any(String), condition: expect.any(String) } });
  });
  it.each([
    { url: "javascript:alert(1)" }, { url: "not a url" }, { amount: "0" }, { amount: "-1" }, { amount: "Infinity" }, { amount: "" }, { currency: "XYZ" }, { observedAt: "2026-02-30" }, { condition: "mint" },
  ])("rejects invalid input %j", patch => { expect(parseListingFields({ ...fields, ...patch }).ok).toBe(false); });
  it("recognizes duplicate fragment variants without removing item query parameters", () => {
    expect(listingIdentity(fields.url + "#details")).toBe(fields.url);
    expect(listingIdentity(fields.url + "?item=2")).not.toBe(listingIdentity(fields.url));
  });
});

describe("listing eligibility feedback", () => {
  it("explains missing fields and condition mismatches instead of counting them", () => {
    const result = listingEligibility([{ url: fields.url }, { ...link("new"), condition: "new" }, { ...link("currency"), price: { amount: 10, currency: "XYZ" } }], "pre-owned", now);
    expect(result[0].reasons).toHaveLength(3);
    expect(result[1].reasons.join(" ")).toContain("New listing");
    expect(result[2].reasons.join(" ")).toContain("unsupported price");
  });
  it("uses the same latest-per-site count as Market, with stable ties", () => {
    const links = [link("one", "2026-09-10"), { ...link("one"), url: "https://www.one.example/other" }, link("two"), { ...link("two"), url: "https://two.example/duplicate" }];
    const feedback = listingEligibility(links, "pre-owned", now);
    expect(feedback.map(row => row.reasons.length === 0)).toEqual([false, true, true, false]);
    const watch = { links } as Watch;
    expect(feedback.filter(row => !row.reasons.length)).toHaveLength(marketValueSummary(watch, "pre-owned", now).observations.length);
  });
});
