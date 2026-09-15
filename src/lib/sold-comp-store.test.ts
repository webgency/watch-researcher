import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoldComp, Watch } from "./types";
import { soldCompRevision } from "./sold-comp-entry";

let tempDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
const base: Watch = { id: "owned", brand: "Fixture", model: "Owned", status: "owned", price: { amount: 500, currency: "USD" }, specs: {}, links: [], tags: [], notes: "Keep this", dateAdded: "2026-01-01T00:00:00.000Z" };
const sale = (source: string, amount = 400): SoldComp => ({ price: { amount, currency: "USD" }, condition: "pre-owned", soldAt: "2026-09-01T12:00:00.000Z", source });
beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-inline-sold-test-"));
  await fs.mkdir(path.join(tempDir, "data"));
  await fs.writeFile(path.join(tempDir, "data/watches.json"), JSON.stringify([base]));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  vi.resetModules();
});
afterEach(async () => { cwdSpy.mockRestore(); await fs.rm(tempDir, { recursive: true, force: true }); });

describe("focused sold comp writes", () => {
  it("keeps simultaneous additions and leaves every other field alone", async () => {
    const { addSoldComp, getWatch } = await import("./store");
    await Promise.all([addSoldComp(base.id, sale("one")), addSoldComp(base.id, sale("two"))]);
    const saved = (await getWatch(base.id))!;
    expect(saved.soldComps?.map((comp) => comp.source).sort()).toEqual(["one", "two"]);
    expect({ ...saved, soldComps: undefined }).toEqual(base);
  });
  it("removes the sale the page showed, even after another was added before it", async () => {
    const { addSoldComp, removeSoldComp, getWatch } = await import("./store");
    await addSoldComp(base.id, sale("one"));
    await addSoldComp(base.id, sale("two"));
    await removeSoldComp(base.id, soldCompRevision(sale("two")));
    expect((await getWatch(base.id))!.soldComps).toEqual([sale("one")]);
  });
  it("rejects removing a sale that is already gone", async () => {
    const { addSoldComp, removeSoldComp } = await import("./store");
    await addSoldComp(base.id, sale("one"));
    await removeSoldComp(base.id, soldCompRevision(sale("one")));
    await expect(removeSoldComp(base.id, soldCompRevision(sale("one")))).rejects.toThrow("already removed");
  });
  it("leaves no empty soldComps array behind after the last removal", async () => {
    const { addSoldComp, removeSoldComp } = await import("./store");
    await addSoldComp(base.id, sale("one"));
    await removeSoldComp(base.id, soldCompRevision(sale("one")));
    const raw = JSON.parse(await fs.readFile(path.join(tempDir, "data/watches.json"), "utf-8"));
    expect(raw[0]).not.toHaveProperty("soldComps");
  });
});
