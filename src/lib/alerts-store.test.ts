import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertState } from "./alerts.mjs";
import { Watch } from "./types";

// Same isolation as store.test.ts: both stores resolve data/ from
// process.cwd() at module load, so each test mocks cwd and resets modules.
let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

const URL = "https://shop.example/bb58";
const observedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const baseWatch: Watch = {
  id: "w1",
  brand: "Tudor",
  model: "Black Bay 58",
  status: "wishlist",
  wishlistTier: "love-it",
  price: { amount: 5250, currency: "USD" },
  links: [{ url: URL, retailer: "Shop", condition: "new", price: { amount: 5250, currency: "USD" }, observedAt }],
  specs: {},
  tags: [],
  dateAdded: "2026-01-01T00:00:00Z",
};

async function seed(watches: Watch[]) {
  await fs.mkdir(path.join(tempDir, "data"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "data", "watches.json"), JSON.stringify(watches, null, 2));
}

async function readAlerts(): Promise<AlertState | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(tempDir, "data", "alerts.json"), "utf-8"));
  } catch {
    return undefined;
  }
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-alerts-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});

afterEach(async () => {
  cwdSpy.mockRestore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("updateWatch alerts", () => {
  const formLink = (amount: number) => ({ ...baseWatch.links[0], price: { amount, currency: "USD" } });

  it("records a price drop from a form-style save, once", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { links: [formLink(4950)] });
    let alerts = await readAlerts();
    expect(alerts?.events.map((e) => e.type)).toEqual(["price_drop"]);
    expect(alerts?.events[0].payload).toMatchObject({ source: "Shop", previousPrice: { amount: 5250, currency: "USD" } });

    // Saving the same price again moves nothing.
    await updateWatch("w1", { links: [formLink(4950)], notes: "again" });
    alerts = await readAlerts();
    expect(alerts?.events).toHaveLength(1);
  });

  it("cites a form-edited ask as seen at the edit, not on the old ask's date", async () => {
    const { updateWatch } = await import("./store");
    await seed([{ ...baseWatch, targetPrice: { amount: 5000, currency: "USD" } }]);
    const editedAt = Date.now();

    // An untouched date field comes back from the form as YYYY-MM-DD.
    await updateWatch("w1", { links: [{ ...formLink(4950), observedAt: observedAt.slice(0, 10) }] });
    const events = (await readAlerts())?.events ?? [];
    expect(events.map((e) => e.type).sort()).toEqual(["price_drop", "target_met"]);
    for (const event of events) {
      expect(new Date(event.payload.asOf).getTime()).toBeGreaterThanOrEqual(editedAt);
    }
  });

  it("leaves alerts.json absent when an edit announces nothing", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { targetPrice: { amount: 6000, currency: "USD" } });
    expect(await readAlerts()).toBeUndefined();
  });

  it("still saves the watch when alerts.json is unreadable", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);
    await fs.writeFile(path.join(tempDir, "data", "alerts.json"), "{ not json");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const updated = await updateWatch("w1", { links: [formLink(4950)] });
    expect(updated?.links[0].price?.amount).toBe(4950);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
