import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Watch } from "./types";

// Same isolation as store.test.ts: store.ts resolves its data directory from
// process.cwd() at module load, so each test mocks cwd and resets modules.
let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

const URL = "https://shop.example/w";

const baseWatch: Watch = {
  id: "w1",
  brand: "Test",
  model: "Model",
  status: "wishlist",
  price: { amount: 5250, currency: "USD" },
  links: [{ url: URL, retailer: "Shop", price: { amount: 5250, currency: "USD" }, observedAt: "2026-07-30T00:00:00.000Z" }],
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
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-ask-history-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});

afterEach(async () => {
  cwdSpy.mockRestore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("updateWatch listing trails", () => {
  it("records a changed ask and keeps the trail through later form-style saves", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    // The form sends links rebuilt from its fields: no askHistory.
    const formLink = (amount: number) => ({ url: URL, retailer: "Shop", price: { amount, currency: "USD" }, observedAt: "2026-07-30T00:00:00.000Z" });

    await updateWatch("w1", { links: [formLink(4950)] });
    let [stored] = await readStored();
    expect(stored.links[0].askHistory?.map((s) => s.price.amount)).toEqual([5250, 4950]);
    expect(stored.links[0].askHistory?.[1].source).toBe("manual");

    // Saving again with nothing changed must neither drop nor extend it.
    await updateWatch("w1", { links: [formLink(4950)], notes: "edited" });
    [stored] = await readStored();
    expect(stored.links[0].askHistory?.map((s) => s.price.amount)).toEqual([5250, 4950]);
  });

  it("leaves links alone when an update does not touch them", async () => {
    const { updateWatch } = await import("./store");
    await seed([baseWatch]);

    await updateWatch("w1", { notes: "no link change" });
    const [stored] = await readStored();
    expect(stored.links[0].askHistory).toBeUndefined();
  });
});
