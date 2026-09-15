import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetailerLink, Watch } from "./types";
import { listingRevision } from "./listing-entry";

let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
const base: Watch = { id: "owned", brand: "Fixture", model: "Owned", status: "owned", price: { amount: 500, currency: "USD" }, targetPrice: { amount: 450, currency: "USD" }, wishlistTier: "shortlist", specs: {}, links: [], tags: [], notes: "Keep this", dateAdded: "2026-01-01T00:00:00.000Z" };
const listing = (source: string, amount = 100): RetailerLink => ({ url: `https://${source}.example/watch`, retailer: source, price: { amount, currency: "USD" }, condition: "pre-owned", observedAt: "2026-09-13T12:00:00.000Z" });
beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-inline-listing-test-"));
  await fs.mkdir(path.join(tempDir, "data"));
  await fs.writeFile(path.join(tempDir, "data/watches.json"), JSON.stringify([base]));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});
afterEach(async () => { cwdSpy.mockRestore(); await fs.rm(tempDir, { recursive: true, force: true }); });

describe("focused listing writes", () => {
  it("keeps simultaneous additions and leaves all non-listing fields alone", async () => {
    const { saveWatchListing, getWatch } = await import("./store");
    await Promise.all([saveWatchListing(base.id, listing("one")), saveWatchListing(base.id, listing("two"))]);
    const saved = (await getWatch(base.id))!;
    expect(saved.links).toHaveLength(2);
    expect({ ...saved, links: [] }).toEqual(base);
  });
  it("rejects duplicate URLs without adding a second entry", async () => {
    const { saveWatchListing, getWatch } = await import("./store");
    await saveWatchListing(base.id, listing("one"));
    await expect(saveWatchListing(base.id, { ...listing("one"), url: listing("one").url + "#details" })).rejects.toThrow("already recorded");
    expect((await getWatch(base.id))!.links).toHaveLength(1);
  });
  it("records price moves, preserves other links and source labels, and does not record polls", async () => {
    const { saveWatchListing, getWatch } = await import("./store");
    await saveWatchListing(base.id, listing("one"));
    await saveWatchListing(base.id, listing("two"));
    const current = (await getWatch(base.id))!.links[0];
    await saveWatchListing(base.id, { ...listing("one", 90), retailer: "derived host", observedAt: "2026-09-14T12:00:00.000Z" }, listingRevision(current));
    const moved = (await getWatch(base.id))!.links[0];
    expect(moved.askHistory?.map(point => point.price.amount)).toEqual([100, 90]);
    expect(moved.retailer).toBe("one");
    await saveWatchListing(base.id, { ...listing("one", 90), observedAt: "2026-09-15T12:00:00.000Z" }, listingRevision(moved));
    const result = (await getWatch(base.id))!;
    expect(result.links[0].askHistory).toEqual(moved.askHistory);
    expect(result.links[0].observedAt).toBe("2026-09-15T12:00:00.000Z");
    expect(result.links[1]).toEqual(listing("two"));
    expect(result.priceHistory).toBeUndefined();
  });
  it("rejects a stale draft rather than overwriting a newer observation", async () => {
    const { saveWatchListing, getWatch } = await import("./store");
    await saveWatchListing(base.id, listing("one"));
    const revision = listingRevision((await getWatch(base.id))!.links[0]);
    await saveWatchListing(base.id, listing("one", 90), revision);
    await expect(saveWatchListing(base.id, listing("one", 80), revision)).rejects.toThrow("changed elsewhere");
    expect((await getWatch(base.id))!.links[0].price?.amount).toBe(90);
  });
  it("returns no watch for a missing id without creating one", async () => {
    const { saveWatchListing } = await import("./store");
    expect(await saveWatchListing("missing", listing("one"))).toBeUndefined();
  });
});
