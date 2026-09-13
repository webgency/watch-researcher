import { describe, expect, it } from "vitest";
import { carryAskHistories, recordAskMove } from "./listing-history.mjs";
import { changeSinceFirst } from "./price-history";
import { normalizeWatchPatch } from "./validation";
import type { Money, RetailerLink } from "./types";

const usd = (amount: number): Money => ({ amount, currency: "USD" });
const NOW = "2026-09-13T12:00:00.000Z";
const URL = "https://shop.example/w";

function link(overrides: Partial<RetailerLink> = {}): RetailerLink {
  return { url: URL, price: usd(5250), observedAt: "2026-07-30T00:00:00.000Z", ...overrides };
}

describe("recordAskMove", () => {
  it("adds nothing when the ask is unchanged, even though observedAt advanced", () => {
    // Moves, not polls: a refresh that re-reads the same ask must not add a line.
    const next = recordAskMove(link(), link({ observedAt: "2026-09-10T00:00:00.000Z" }), NOW);
    expect(next.askHistory).toBeUndefined();
  });

  it("seeds the prior ask on the first move so the trail shows what it moved from", () => {
    const next = recordAskMove(link(), link({ price: usd(4950), observedAt: "2026-09-12T00:00:00.000Z" }), NOW, "scrape");
    expect(next.askHistory).toEqual([
      { price: usd(5250), date: "2026-07-30T00:00:00.000Z" },
      { price: usd(4950), date: "2026-09-12T00:00:00.000Z", source: "scrape" },
    ]);
  });

  it("appends later moves, rises included, and carries the trail through unchanged reads", () => {
    const first = recordAskMove(link(), link({ price: usd(5400), observedAt: "2026-08-10T00:00:00.000Z" }), NOW);
    const second = recordAskMove(first, { ...first, price: usd(5100), observedAt: "2026-09-12T00:00:00.000Z" }, NOW);
    const repeat = recordAskMove(second, { url: URL, price: usd(5100), observedAt: "2026-09-13T00:00:00.000Z" }, NOW);
    expect(repeat.askHistory?.map((s) => s.price.amount)).toEqual([5250, 5400, 5100]);
  });

  it("does not seed from an undated prior ask", () => {
    // A trail that starts at an invented date would be worse than no trail yet.
    const next = recordAskMove(link({ observedAt: undefined }), link({ price: usd(4950) }), NOW);
    expect(next.askHistory).toBeUndefined();
  });

  it("dates a form edit that kept the old observedAt to now, not to the old ask's date", () => {
    const next = recordAskMove(link(), link({ price: usd(4950) }), NOW);
    expect(next.askHistory?.[1].date).toBe(NOW);
  });

  it("never dates a move before the entry it follows", () => {
    const next = recordAskMove(link(), link({ price: usd(4950), observedAt: "2026-07-01T00:00:00.000Z" }), NOW);
    expect(next.askHistory?.[1].date).toBe(NOW);
  });

  it("restarts the trail on a currency change instead of comparing through a rate", () => {
    const withTrail = link({ price: usd(4950), askHistory: [{ price: usd(5250), date: "2026-07-30" }, { price: usd(4950), date: "2026-09-12" }] });
    const next = recordAskMove(withTrail, { url: URL, price: { amount: 4600, currency: "EUR" }, observedAt: NOW, askHistory: withTrail.askHistory }, NOW);
    expect(next.askHistory).toBeUndefined();
  });
});

describe("carryAskHistories", () => {
  const trail = [
    { price: usd(5250), date: "2026-07-30T00:00:00.000Z" },
    { price: usd(4950), date: "2026-09-12T00:00:00.000Z" },
  ];

  it("keeps a trail across a form save that never sends askHistory", () => {
    const [kept] = carryAskHistories([link({ price: usd(4950), askHistory: trail })], [{ url: URL, price: usd(4950) }], NOW);
    expect(kept.askHistory).toEqual(trail);
  });

  it("matches by URL, so a new listing starts without a trail", () => {
    const [fresh] = carryAskHistories([link({ askHistory: trail })], [{ url: "https://other.example/w", price: usd(4000) }], NOW);
    expect(fresh.askHistory).toBeUndefined();
  });

  it("leaves an explicitly supplied askHistory alone", () => {
    const imported = [{ price: usd(6000), date: "2026-01-01T00:00:00.000Z" }, { price: usd(4950), date: "2026-02-01T00:00:00.000Z" }];
    const [kept] = carryAskHistories([link({ askHistory: trail })], [{ url: URL, price: usd(4950), askHistory: imported }], NOW);
    expect(kept.askHistory).toBe(imported);
  });

  it("does not mutate the links it was given", () => {
    const input = [{ url: URL, price: usd(4950) }];
    carryAskHistories([link()], input, NOW);
    expect(input[0]).toEqual({ url: URL, price: usd(4950) });
  });
});

describe("changeSinceFirst", () => {
  it("reports a drop in the series' own currency", () => {
    const change = changeSinceFirst([
      { price: { amount: 5000, currency: "EUR" }, date: "2026-07-30" },
      { price: { amount: 5200, currency: "EUR" }, date: "2026-08-10" },
      { price: { amount: 4700, currency: "EUR" }, date: "2026-09-12" },
    ]);
    expect(change?.delta).toEqual({ amount: -300, currency: "EUR" });
    expect(change?.moves).toBe(2);
    expect(change?.first.date).toBe("2026-07-30");
  });

  it("needs two snapshots", () => {
    expect(changeSinceFirst([{ price: usd(5000), date: "2026-07-30" }])).toBeUndefined();
    expect(changeSinceFirst(undefined)).toBeUndefined();
  });
});

describe("askHistory validation", () => {
  it("keeps a valid trail on a link", () => {
    const askHistory = [{ price: usd(5250), date: "2026-07-30T00:00:00.000Z" }, { price: usd(4950), date: "2026-09-12T00:00:00.000Z" }];
    const result = normalizeWatchPatch({ links: [{ url: URL, price: usd(4950), askHistory }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.links?.[0].askHistory).toEqual(askHistory);
  });

  it("rejects a trail that repeats a price or runs backwards", () => {
    const result = normalizeWatchPatch({
      links: [
        {
          url: URL,
          price: usd(4950),
          askHistory: [
            { price: usd(4950), date: "2026-09-12T00:00:00.000Z" },
            { price: usd(4950), date: "2026-07-30T00:00:00.000Z" },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("links[0].askHistory[1].date is earlier");
    expect(result.errors.join(" ")).toContain("links[0].askHistory[1] repeats the previous price");
  });
});
