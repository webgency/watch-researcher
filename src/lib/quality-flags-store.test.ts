import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Watch, WatchInput } from "./types";

let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
const existing: Watch = {
  id: "plain", brand: "Fixture", model: "Plain", status: "wishlist",
  price: { amount: 500, currency: "USD" }, specs: { crystal: "Sapphire" }, links: [], tags: [], dateAdded: "2026-01-01T00:00:00.000Z",
};
beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-quality-flags-test-"));
  await fs.mkdir(path.join(tempDir, "data"));
  await fs.writeFile(path.join(tempDir, "data/watches.json"), JSON.stringify([existing]));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});
afterEach(async () => { cwdSpy.mockRestore(); await fs.rm(tempDir, { recursive: true, force: true }); });

describe("crystal AR inference on save", () => {
  it("records arCoated when a new watch's crystal states AR", async () => {
    const { addWatch } = await import("./store");
    const input: WatchInput = { brand: "Fixture", model: "Coated", status: "wishlist", specs: { crystal: "Sapphire (AR)" }, links: [], tags: [] };
    expect((await addWatch(input)).qualityFlags).toEqual({ arCoated: true });
  });

  it("records it when an edit adds AR to the crystal, and keeps an explicit false", async () => {
    const { updateWatch } = await import("./store");
    const edited = await updateWatch(existing.id, { specs: { crystal: "Domed sapphire, internal AR" } });
    expect(edited?.qualityFlags).toEqual({ arCoated: true });
    const explicit = await updateWatch(existing.id, { qualityFlags: { arCoated: false } });
    expect(explicit?.qualityFlags).toEqual({ arCoated: false });
  });

  it("leaves a plain sapphire crystal's AR unknown", async () => {
    const { updateWatch } = await import("./store");
    expect((await updateWatch(existing.id, { notes: "checked" }))?.qualityFlags).toBeUndefined();
  });
});
