import { describe, expect, it } from "vitest";
import { candidatePriceSummary, groupCandidates } from "./candidate-search";
import { tradeUpModel } from "./trade-up";
import type { Watch } from "./types";

const now = new Date("2026-09-13T12:00:00Z");
const owned: Watch = {
  id: "owned", brand: "Test", model: "Owned", status: "owned",
  price: { amount: 7000, currency: "USD" }, specs: {}, tags: [], links: [], dateAdded: "2026-01-01",
};
const wish = (id: string, brand: string, model: string, extra: Partial<Watch> = {}): Watch =>
  ({ ...owned, id, brand, model, status: "wishlist", ...extra });

const watches: Watch[] = [
  owned,
  wish("zodiac", "Zodiac", "Super Sea Wolf", { wishlistTier: "watching" }),
  wish("nomos", "NOMOS Glashütte", "Club Campus", { wishlistTier: "shortlist" }),
  wish("baltic", "Baltic", "Aquascaphe", { wishlistTier: "shortlist" }),
  wish("unset", "Farer", "Nevada", {}),
  wish("pass", "Nodus", "Sector Deep", { wishlistTier: "pass" }),
];
const candidates = tradeUpModel(owned, watches, now)!.candidates;

describe("trade-up candidate order and search", () => {
  it("orders the shortlist first, then watching (including unset), then pass, A-Z within each", () => {
    expect(candidates.map((candidate) => candidate.id)).toEqual(["baltic", "nomos", "unset", "zodiac", "pass"]);
  });

  it("groups every candidate when there is no query, omitting nothing", () => {
    expect(groupCandidates(candidates, "").map((group) => [group.label, group.candidates.map((c) => c.id)])).toEqual([
      ["Shortlist", ["baltic", "nomos"]],
      ["Watching", ["unset", "zodiac"]],
      ["Pass", ["pass"]],
    ]);
  });

  it("matches every term against brand and model, ignoring case and accents", () => {
    expect(groupCandidates(candidates, "  nomos GLASHUTTE ").flatMap((group) => group.candidates.map((c) => c.id))).toEqual(["nomos"]);
    expect(groupCandidates(candidates, "sea").flatMap((group) => group.candidates.map((c) => c.id))).toEqual(["zodiac"]);
    expect(groupCandidates(candidates, "sea wolf zodiac")).toHaveLength(1);
    expect(groupCandidates(candidates, "rolex")).toEqual([]);
  });

  it("labels the comparison price as an ask, a target, or neither", () => {
    const priced = tradeUpModel(owned, [
      owned,
      wish("ask", "A", "Ask", { links: [{ url: "https://shop.example/a", price: { amount: 1200, currency: "USD" }, condition: "new", observedAt: "2026-09-12" }] }),
      wish("target", "B", "Target", { targetPrice: { amount: 900, currency: "USD" } }),
      wish("none", "C", "None"),
    ], now)!.candidates;
    const byId = Object.fromEntries(priced.map((candidate) => [candidate.id, candidatePriceSummary(candidate)]));
    expect(byId.ask).toMatch(/1,200.* ask$/);
    expect(byId.target).toMatch(/^Target .*900/);
    expect(byId.none).toBe("No ask or target");
  });
});
