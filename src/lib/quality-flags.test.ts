import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeStanding, scoreDimensionEvidence } from "./scoring";
import { crystalStatesAr, withCrystalArInference } from "./quality-flags";
import { extractQualityFlags, extractSpecs, productExtractionText } from "./scrape";
import type { Watch } from "./types";

const balticPage = readFileSync(new URL("./fixtures/baltic-aquascaphe-mk2-blue.html", import.meta.url), "utf8");

let nextId = 0;
function diver(overrides: Partial<Watch> = {}): Watch {
  nextId += 1;
  return {
    id: `diver-${nextId}`,
    brand: "Testbrand",
    model: "Diver",
    status: "wishlist",
    scoringCategory: "diver",
    price: { amount: 700, currency: "USD" },
    tags: [],
    links: [],
    dateAdded: "2026-01-01T00:00:00.000Z",
    specs: {
      caliber: "Miyota 9039",
      powerReserveHours: 42,
      caseDiameterMm: 39,
      caseThicknessMm: 12.5,
      lugToLugMm: 46,
      waterResistanceM: 200,
      crystal: "Sapphire",
    },
    ...overrides,
  };
}
const standing = (watch: Watch) => computeStanding(watch, [watch]);

describe("omitted quality flags are unknown, never false", () => {
  it("never scores an omitted flag below an explicitly recorded absence", () => {
    const omitted = diver();
    const explicitFalse = diver({ qualityFlags: { arCoated: false } });

    // Omitted leaves case craft unrated; an explicit false is recorded evidence.
    expect(scoreDimensionEvidence(omitted).caseCraft).toBeUndefined();
    expect(scoreDimensionEvidence(explicitFalse).caseCraft).toBeDefined();
    expect(standing(omitted).valueScore!).toBeGreaterThanOrEqual(standing(explicitFalse).valueScore!);
  });

  it("gives an inferred AR coating exactly the credit of a hand-filled one", () => {
    const crystal = "Double-dome sapphire, internal AR";
    const inferred = withCrystalArInference(diver({ specs: { ...diver().specs, crystal } }));
    const handFilled = diver({ specs: { ...diver().specs, crystal }, qualityFlags: { arCoated: true } });
    expect(scoreDimensionEvidence(inferred).caseCraft).toEqual(scoreDimensionEvidence(handFilled).caseCraft);
  });
});

describe("Baltic Aquascaphe MK2 Blue (diver page with press and customer reviews)", () => {
  it("reads the stated diver evidence and ignores what reviewers say", () => {
    const text = productExtractionText(undefined, balticPage);
    expect(text).not.toMatch(/micro adjust|quick-release|Titanium/i);
    expect(extractSpecs(text)).toMatchObject({
      caseDiameterMm: 37,
      caseThicknessMm: 12.9,
      lugToLugMm: 45,
      lugWidthMm: 20,
      caliber: "Miyota 9039",
      movement: "automatic",
      powerReserveHours: 42,
      waterResistanceM: 200,
      crystal: "Sapphire",
    });
    expect(extractQualityFlags(text)).toEqual({ sapphireBezelInsert: true, arCoated: true });
  });

  it("scores no lower than an empty-flag clone at the same price, on more evidence", () => {
    const text = productExtractionText(undefined, balticPage);
    const scraped = diver({ price: { amount: 655, currency: "EUR" }, specs: extractSpecs(text), qualityFlags: extractQualityFlags(text) });
    const emptyClone: Watch = { ...scraped, id: "empty-clone", qualityFlags: undefined };
    expect(standing(scraped).valueScore!).toBeGreaterThanOrEqual(standing(emptyClone).valueScore!);
    expect(standing(scraped).evidenceCoverage).toBeGreaterThan(standing(emptyClone).evidenceCoverage);
  });
});

describe("crystal to AR inference", () => {
  it("reads an AR coating stated in the crystal description", () => {
    expect(withCrystalArInference(diver({ specs: { crystal: "Double-dome sapphire, internal AR" } })).qualityFlags).toEqual({ arCoated: true });
    expect(withCrystalArInference(diver({ specs: { crystal: "Saphirglas, Antireflex" } })).qualityFlags).toEqual({ arCoated: true });
    expect(withCrystalArInference(diver({ specs: { crystal: "Sapphire crystal with anti-reflective coating" }, qualityFlags: { drilledLugs: true } })).qualityFlags)
      .toEqual({ drilledLugs: true, arCoated: true });
  });

  it("lets an explicit value or a layer count win over the crystal text", () => {
    const explicitFalse = diver({ specs: { crystal: "Sapphire (AR)" }, qualityFlags: { arCoated: false } });
    expect(withCrystalArInference(explicitFalse).qualityFlags).toEqual({ arCoated: false });
    const layers = diver({ specs: { crystal: "Sapphire (AR)" }, qualityFlags: { arLayers: 3 } });
    expect(withCrystalArInference(layers).qualityFlags).toEqual({ arLayers: 3 });
  });

  it("leaves AR unknown when the crystal doesn't mention it", () => {
    const plain = diver({ specs: { crystal: "Sapphire" } });
    expect(withCrystalArInference(plain)).toBe(plain);
    expect(scoreDimensionEvidence(withCrystalArInference(plain)).caseCraft).toBeUndefined();
    expect(crystalStatesAr("Clear sapphire, hardened")).toBe(false);
    expect(crystalStatesAr(undefined)).toBe(false);
  });
});
