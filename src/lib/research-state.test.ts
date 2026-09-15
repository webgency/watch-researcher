import { describe, expect, it } from "vitest";
import { readCollectionFilters, readValueFilters, writeCollectionFilters, writeValueFilters, readSelection, safeResearchUrl, readTradeUpSelection, writeTradeUpSelection } from "./research-state";

describe("research URLs", () => {
  it("round-trips collection filters with encoded text and multiple priorities", () => {
    const state = { ...readCollectionFilters(new URLSearchParams()), query: "Brew & café", wishlistTiers: ["shortlist", "watching"] as const, freshOffersOnly: true, sort: "priceAsc" as const };
    const params = writeCollectionFilters(new URLSearchParams("campaign=shared"), { ...state, wishlistTiers: [...state.wishlistTiers] });
    expect(readCollectionFilters(new URLSearchParams(params.toString()))).toEqual({ ...state, wishlistTiers: [...state.wishlistTiers] });
    expect(params.get("campaign")).toBe("shared");
    expect(params.has("status")).toBe(false);
  });
  it("ignores invalid collection enums and deduplicates priorities", () => {
    const state = readCollectionFilters(new URLSearchParams("status=oops&sort=bad&fresh=true&priority=shortlist,bad,shortlist"));
    expect(state).toMatchObject({ status: "all", sort: "wishlistTier", freshOffersOnly: false, wishlistTiers: ["shortlist"] });
  });
  it("round-trips all Value filters and removes defaults on reset", () => {
    const params = new URLSearchParams("q=9039&status=owned&sort=price-asc&category=dress&min=100.50&max=2000&design=4&confidence=high&deal=1&priority=love-it");
    const state = readValueFilters(params);
    expect(readValueFilters(writeValueFilters(new URLSearchParams(), state))).toEqual(state);
    expect(writeValueFilters(params, readValueFilters(new URLSearchParams())).toString()).toBe("");
  });
  it("rejects invalid numeric, design and enum inputs instead of hiding everything", () => {
    expect(readValueFilters(new URLSearchParams("min=-1&max=Infinity&design=99&status=sold&confidence=bogus&category=bogus"))).toMatchObject({ minPrice: "", maxPrice: "", minDesign: "", status: "wishlist", confidence: "all", category: "all" });
  });
});
describe("stored research state", () => {
  it("round-trips trade-up context and rejects removed or non-wishlist candidates", () => {
    const params = writeTradeUpSelection(new URLSearchParams("other=keep"), { candidateId: "next", basis: "target" });
    expect(readTradeUpSelection(params, ["next"])).toEqual({ candidateId: "next", basis: "target" });
    expect(params.get("other")).toBe("keep");
    expect(readTradeUpSelection(params, [])).toMatchObject({ candidateId: "" });
    expect(writeTradeUpSelection(params, { candidateId: "", basis: "ask" }).toString()).toBe("other=keep");
  });
  it("bounds and validates the shortlist", () => {
    expect(readSelection('["w1","w1",null,{},"w2","w3","w4","w5"]')).toEqual(["w1", "w2", "w3", "w4"]);
    expect(readSelection('{"id":"w1"}')).toEqual([]);
    expect(readSelection('broken')).toEqual([]);
  });
  it("only allows remembered links to the exact internal research page", () => {
    expect(safeResearchUrl('/?q=Baltic', '/')).toBe('/?q=Baltic');
    expect(safeResearchUrl('/value?min=500', '/value')).toBe('/value?min=500');
    for (const url of ['https://example.com', '//example.com', 'javascript:alert(1)', '/watch/w01', '/value']) expect(safeResearchUrl(url, '/')).toBe('/');
  });
});
