import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Watch } from "./types";

// store.ts resolves its data directory from process.cwd() once, at module load.
// So each test needs both a mocked cwd AND a module registry reset, otherwise
// the cached module keeps writing to the first test's temp directory.
let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

const baseWatch: Watch = {
  id: "w1",
  brand: "Test",
  model: "Model",
  status: "wishlist",
  price: { amount: 500, currency: "USD" },
  links: [],
  specs: {},
  tags: [],
  dateAdded: "2026-01-01T00:00:00Z",
};

async function seed(watches: Watch[]) {
  await fs.mkdir(path.join(tempDir, "data"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "data", "watches.json"), JSON.stringify(watches, null, 2));
}

async function readStored(): Promise<Watch[]> {
  return JSON.parse(await fs.readFile(path.join(tempDir, "data", "watches.json"), "utf-8"));
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-store-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});

afterEach(async () => {
  cwdSpy.mockRestore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("updateWatch price history", () => {
  it("records a snapshot when the price changes", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { price: { amount: 450, currency: "USD" } });

    const [stored] = await readStored();
    const latest = stored.priceHistory?.[stored.priceHistory.length - 1];
    expect(latest?.price.amount).toBe(450);
    expect(latest?.source).toBe("manual");
    expect(stored.priceUpdatedAt).toBeTruthy();
  });

  it("seeds the outgoing price when a watch has no series yet", async () => {
    const { updateWatch } = await import("./store");
    await seed([{ ...baseWatch, priceUpdatedAt: "2026-03-01T00:00:00Z" }]);

    await updateWatch("w1", { price: { amount: 450, currency: "USD" } });

    const [stored] = await readStored();
    // The price it moved *from* is preserved, dated to when it was last known.
    expect(stored.priceHistory?.map((s) => s.price.amount)).toEqual([500, 450]);
    expect(stored.priceHistory?.[0].date).toBe("2026-03-01T00:00:00Z");
  });

  it("falls back to dateAdded when seeding a watch with no priceUpdatedAt", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { price: { amount: 450, currency: "USD" } });

    const [stored] = await readStored();
    expect(stored.priceHistory?.[0].date).toBe("2026-01-01T00:00:00Z");
  });

  it("appends to an existing series", async () => {
    const { updateWatch } = await import("./store");
    await seed([
      {
        ...baseWatch,
        priceHistory: [{ price: { amount: 500, currency: "USD" }, date: "2026-01-01T00:00:00Z" }],
      },
    ]);

    await updateWatch("w1", { price: { amount: 450, currency: "USD" } });

    const [stored] = await readStored();
    expect(stored.priceHistory?.map((s) => s.price.amount)).toEqual([500, 450]);
  });

  it("does not record anything when the price is unchanged", async () => {
    const { updateWatch } = await import("./store");
    await seed([
      {
        ...baseWatch,
        priceHistory: [{ price: { amount: 500, currency: "USD" }, date: "2026-01-01T00:00:00Z" }],
      },
    ]);

    await updateWatch("w1", { price: { amount: 500, currency: "USD" }, notes: "edited" });

    const [stored] = await readStored();
    expect(stored.priceHistory).toHaveLength(1);
    expect(stored.notes).toBe("edited");
  });

  it("leaves history alone on an edit that does not touch price", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { notes: "just a note" });

    const [stored] = await readStored();
    expect(stored.priceHistory).toBeUndefined();
  });

  it("defers to a caller that supplies its own history", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    const imported = [
      { price: { amount: 800, currency: "USD" }, date: "2025-01-01T00:00:00Z" },
      { price: { amount: 450, currency: "USD" }, date: "2025-06-01T00:00:00Z" },
    ];
    await updateWatch("w1", { price: { amount: 450, currency: "USD" }, priceHistory: imported });

    const [stored] = await readStored();
    expect(stored.priceHistory?.map((s) => s.price.amount)).toEqual([800, 450]);
  });
});

describe("addWatch price history", () => {
  it("seeds a snapshot for a watch created with a price", async () => {
    const { addWatch } = await import("./store");
    await seed([]);

    const created = await addWatch({
      brand: "New",
      model: "Watch",
      status: "wishlist",
      price: { amount: 1200, currency: "USD" },
      links: [],
      specs: {},
      tags: [],
    });

    expect(created.priceHistory).toHaveLength(1);
    expect(created.priceHistory?.[0].price.amount).toBe(1200);
  });

  it("creates no history for a watch added without a price", async () => {
    const { addWatch } = await import("./store");
    await seed([]);

    const created = await addWatch({
      brand: "New",
      model: "Watch",
      status: "wishlist",
      links: [],
      specs: {},
      tags: [],
    });

    expect(created.priceHistory).toBeUndefined();
  });
});
