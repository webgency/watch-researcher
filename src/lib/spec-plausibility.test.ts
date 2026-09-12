import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PLAUSIBILITY_RULES,
  plausibilityErrors,
  plausibilityIssues,
  plausibilityWarnings,
} from "./spec-plausibility.mjs";
import { normalizeWatchInput, specPlausibilityWarnings } from "./validation";
import type { Watch, WatchSpecs } from "./types";

const ids = (specs: WatchSpecs) => plausibilityIssues(specs).map((i: { id: string }) => i.id);

/** A case that breaks nothing, for building single-rule failures from. */
const sane: WatchSpecs = {
  caseDiameterMm: 40,
  caseThicknessMm: 12,
  lugToLugMm: 47,
  lugWidthMm: 20,
  powerReserveHours: 42,
  caliber: "Sellita SW200-1",
};

describe("plausibility rules", () => {
  it("passes a sane case", () => {
    expect(plausibilityIssues(sane)).toEqual([]);
  });

  it("throws on nothing when only brand and model are known", () => {
    // Every rule is gated on its own inputs, so an empty spec block trips none.
    expect(plausibilityIssues({})).toEqual([]);
    expect(plausibilityIssues(undefined)).toEqual([]);
  });

  // One passing and one failing fixture per rule, so a rule cannot be
  // silently disabled by a typo in its `applies` guard.
  const cases: Array<[string, WatchSpecs]> = [
    ["thickness-under-diameter", { caseDiameterMm: 15, caseThicknessMm: 15.5 }],
    ["thickness-ratio", { caseDiameterMm: 39, caseThicknessMm: 20 }],
    ["lug-to-lug-floor", { caseDiameterMm: 42, lugToLugMm: 30 }],
    ["lug-to-lug-ceiling", { caseDiameterMm: 30, lugToLugMm: 50 }],
    ["lug-width-under-diameter", { caseDiameterMm: 20, lugWidthMm: 20 }],
    ["caliber-garbage", { caliber: "3 produced by Sellita based on" }],
    ["lug-to-lug-equals-diameter", { caseDiameterMm: 39, lugToLugMm: 39 }],
    ["diameter-band", { caseDiameterMm: 48 }],
    ["power-reserve-band", { powerReserveHours: 500 }],
    ["caliber-length", { caliber: "Co-Axial Master Chronometer 8800" }],
  ];

  it.each(cases)("flags %s", (id, specs) => {
    expect(ids(specs)).toContain(id);
  });

  it("covers every rule with a fixture", () => {
    expect(cases.map(([id]) => id).sort()).toEqual(
      PLAUSIBILITY_RULES.map((r: { id: string }) => r.id).sort()
    );
  });

  it("separates what cannot be right from what is merely unlikely", () => {
    // A 15mm case with a 15.5mm thickness cannot be right; a long caliber
    // name usually is. Only the first kind may fail validate:data.
    expect(plausibilityErrors({ caseDiameterMm: 15, caseThicknessMm: 15.5 }).length).toBeGreaterThan(0);
    expect(plausibilityErrors({ caliber: "Co-Axial Master Chronometer 8800" })).toEqual([]);
    expect(plausibilityWarnings({ caliber: "Co-Axial Master Chronometer 8800" })).toHaveLength(1);
  });

  it("allows a square case to measure the same across as lug-to-lug", () => {
    // The Echo/Neutra Rivanera is 40mm wide and 40mm lug-to-lug per the
    // manufacturer. A strict lugToLug > diameter rule would condemn it.
    expect(plausibilityErrors({ caseDiameterMm: 40, lugToLugMm: 40 })).toEqual([]);
    expect(plausibilityWarnings({ caseDiameterMm: 40, lugToLugMm: 40 })).toHaveLength(1);
  });
});

describe("the write path warns and never rejects", () => {
  it("accepts a deliberately messy scraped record, with warnings", () => {
    // The add form's URL autofill produced most of the bad values in the first
    // place. Rejecting a half-scraped record would lose the good fields along
    // with the bad, so the write path only ever warns.
    const result = normalizeWatchInput({
      brand: "Scraped",
      model: "Messy",
      links: [],
      tags: [],
      specs: {
        caseDiameterMm: 15,
        caseThicknessMm: 15.5,
        lugToLugMm: 49,
        caliber: "3 produced by Sellita based on",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.join(" ")).toContain("caseThicknessMm");
    }
  });

  it("reports no warnings for a clean record", () => {
    expect(specPlausibilityWarnings(sane)).toEqual([]);
  });
});

describe("the committed collection", () => {
  it("has no plausibility errors", () => {
    const raw = JSON.parse(readFileSync(new URL("../../data/watches.json", import.meta.url), "utf8"));
    const watches: Watch[] = Array.isArray(raw) ? raw : raw.watches;
    const offenders = watches
      .flatMap((w) => plausibilityErrors(w.specs).map((i: { message: string }) => `${w.id}: ${i.message}`));
    expect(offenders).toEqual([]);
  });
});
