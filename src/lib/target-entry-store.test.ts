import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Watch } from "./types";
import { targetRevision } from "./target-entry";

let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
const base: Watch = {
  id: "wish", brand: "Fixture", model: "Wish", status: "wishlist", wishlistTier: "shortlist",
  price: { amount: 500, currency: "USD" }, specs: {}, tags: [], notes: "Keep this", dateAdded: "2026-01-01T00:00:00.000Z",
  links: [{ url: "https://shop.example/w", retailer: "shop.example", price: { amount: 500, currency: "USD" }, condition: "new", observedAt: new Date().toISOString() }],
};
beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-inline-target-test-"));
  await fs.mkdir(path.join(tempDir, "data"));
  await fs.writeFile(path.join(tempDir, "data/watches.json"), JSON.stringify([base]));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});
afterEach(async () => { cwdSpy.mockRestore(); await fs.rm(tempDir, { recursive: true, force: true }); });

async function alertTypes(): Promise<string[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(tempDir, "data/alerts.json"), "utf-8"));
    const events = Array.isArray(raw) ? raw : raw.alerts ?? [];
    return events.map((event: { type: string }) => event.type);
  } catch { return []; }
}

describe("focused target writes", () => {
  it("sets a target without touching any other field or firing target_met", async () => {
    const { saveWatchTarget, getWatch } = await import("./store");
    // Above the current price: a market alert would fire if this were news.
    await saveWatchTarget(base.id, { amount: 600, currency: "USD" }, targetRevision());
    const saved = (await getWatch(base.id))!;
    expect(saved.targetPrice).toEqual({ amount: 600, currency: "USD" });
    expect({ ...saved, targetPrice: undefined }).toEqual({ ...base, targetPrice: undefined });
    expect(saved.priceHistory).toBeUndefined();
    expect(await alertTypes()).not.toContain("target_met");
  });
  it("clears a target", async () => {
    const { saveWatchTarget, getWatch } = await import("./store");
    await saveWatchTarget(base.id, { amount: 450, currency: "USD" }, targetRevision());
    await saveWatchTarget(base.id, undefined, targetRevision({ amount: 450, currency: "USD" }));
    expect((await getWatch(base.id))!.targetPrice).toBeUndefined();
  });
  it("rejects a stale draft rather than overwriting a newer target", async () => {
    const { saveWatchTarget, getWatch } = await import("./store");
    await saveWatchTarget(base.id, { amount: 450, currency: "USD" }, targetRevision());
    await expect(saveWatchTarget(base.id, { amount: 400, currency: "USD" }, targetRevision())).rejects.toThrow("changed elsewhere");
    expect((await getWatch(base.id))!.targetPrice?.amount).toBe(450);
  });
  it("returns no watch for a missing id", async () => {
    const { saveWatchTarget } = await import("./store");
    expect(await saveWatchTarget("missing", { amount: 1, currency: "USD" }, targetRevision())).toBeUndefined();
  });
});
