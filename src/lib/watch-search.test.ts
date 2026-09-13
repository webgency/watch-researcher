import { describe, expect, it } from "vitest";
import type { Watch } from "./types";
import { matchesWatchSearch } from "./watch-search";

const watch: Watch = {
  id: "search-test", brand: "Baltic", model: "Aquascaphe Blue",
  referenceNumber: "AQ-001", status: "wishlist", wishlistTier: "must-have",
  specs: { caliber: "Miyota 9039", movement: "automatic" }, tags: ["diver"],
  links: [], dateAdded: "2026-01-01",
};

describe("watch search", () => {
  it("matches terms across brand, reference, and caliber without case or whitespace sensitivity", () => {
    expect(matchesWatchSearch(watch, "  BALTIC   9039 AQ-001 ")).toBe(true);
    expect(matchesWatchSearch(watch, "baltic 9015")).toBe(false);
  });
  it("retains model, priority, tags and optional collection peer-label search", () => {
    expect(matchesWatchSearch(watch, "aquascaphe must have diver")).toBe(true);
    expect(matchesWatchSearch(watch, "$500-1000", ["divers, $500-1000"])).toBe(true);
    expect(matchesWatchSearch(watch, "$500-1000")).toBe(false);
  });
  it("accepts an empty query and does not turn missing fields into searchable text", () => {
    const sparse = { ...watch, referenceNumber: undefined, wishlistTier: undefined, specs: {}, tags: [] };
    expect(matchesWatchSearch(sparse, " \n ")).toBe(true);
    expect(matchesWatchSearch(sparse, "undefined")).toBe(false);
    expect(matchesWatchSearch(sparse, "9039")).toBe(false);
  });
});
