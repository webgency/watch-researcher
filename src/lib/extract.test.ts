import { describe, expect, it } from "vitest";

import { Extraction, sanitizeSpecs, toExtractedDetails } from "./extract";

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    brand: null,
    model: null,
    referenceNumber: null,
    specs: {
      caseDiameterMm: null,
      caseThicknessMm: null,
      lugToLugMm: null,
      lugWidthMm: null,
      caseMaterial: null,
      movement: null,
      caliber: null,
      powerReserveHours: null,
      waterResistanceM: null,
      crystal: null,
      dialColor: null,
      braceletStrap: null,
      complications: null,
      ...overrides.specs,
    },
    tags: [],
    qualityFlags: {
      regulatedPositions: null,
      accuracySpecSpd: null,
      hardenedCoatingHv: null,
      antimagneticAm: null,
      sapphireBezelInsert: null,
      drilledLugs: null,
      microAdjustClasp: null,
      quickRelease: null,
      braceletIncluded: null,
      arLayers: null,
      ...overrides.qualityFlags,
    },
    friction: {
      availability: null,
      expectedShipDate: null,
      braceletUpchargeUsd: null,
      ...overrides.friction,
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => !["specs", "qualityFlags", "friction"].includes(key))
    ),
  };
}

describe("sanitizeSpecs", () => {
  it("drops an impossible thickness but keeps the plausible diameter (the Laventure bug)", () => {
    const cleaned = sanitizeSpecs({ caseDiameterMm: 38.9, caseThicknessMm: 38.9 });
    expect(cleaned.caseThicknessMm).toBeUndefined();
    expect(cleaned.caseDiameterMm).toBe(38.9);
  });

  it("drops both dimensions when each is plausible alone but thickness >= diameter", () => {
    const cleaned = sanitizeSpecs({ caseDiameterMm: 18, caseThicknessMm: 20 });
    expect(cleaned.caseDiameterMm).toBeUndefined();
    expect(cleaned.caseThicknessMm).toBeUndefined();
  });

  it("drops an implausible diameter (the 15mm William Wood bug)", () => {
    const cleaned = sanitizeSpecs({ caseDiameterMm: 15, caseThicknessMm: 15.5 });
    expect(cleaned.caseDiameterMm).toBeUndefined();
    // Thickness 15.5 is plausible on its own and survives once the bad diameter is gone.
    expect(cleaned.caseThicknessMm).toBe(15.5);
  });

  it("keeps plausible values untouched", () => {
    const specs = {
      caseDiameterMm: 40,
      caseThicknessMm: 12,
      lugToLugMm: 47,
      lugWidthMm: 20,
      waterResistanceM: 200,
      powerReserveHours: 70,
      caliber: "Miyota 9015",
    };
    expect(sanitizeSpecs(specs)).toEqual(specs);
  });

  it("drops a lug-to-lug smaller than the diameter", () => {
    expect(sanitizeSpecs({ caseDiameterMm: 42, lugToLugMm: 30 }).lugToLugMm).toBeUndefined();
  });
});

describe("toExtractedDetails", () => {
  it("maps nulls to absent fields instead of zeros", () => {
    const details = toExtractedDetails(makeExtraction());
    expect(details.specs).toEqual({});
    expect(details.tags).toEqual([]);
    expect(details.qualityFlags).toBeUndefined();
    expect(details.friction).toBeUndefined();
    expect(details.brand).toBeUndefined();
  });

  it("keeps stated values and trims strings", () => {
    const details = toExtractedDetails(
      makeExtraction({
        brand: "  Baltic ",
        specs: { caliber: " Miyota 9039 ", caseDiameterMm: 36.5, waterResistanceM: 100 } as never,
        tags: ["diver", "diver"],
        qualityFlags: { braceletIncluded: true, arLayers: 3 } as never,
      })
    );
    expect(details.brand).toBe("Baltic");
    expect(details.specs.caliber).toBe("Miyota 9039");
    expect(details.specs.caseDiameterMm).toBe(36.5);
    expect(details.tags).toEqual(["diver"]);
    expect(details.qualityFlags).toEqual({ braceletIncluded: true, arLayers: 3 });
  });

  it("only includes friction when availability is known, and never brandLiquidity", () => {
    const none = toExtractedDetails(
      makeExtraction({ friction: { braceletUpchargeUsd: 189 } as never })
    );
    expect(none.friction).toBeUndefined();

    const preorder = toExtractedDetails(
      makeExtraction({
        friction: {
          availability: "pre-order",
          expectedShipDate: "2026-11-01",
          braceletUpchargeUsd: 189,
        } as never,
      })
    );
    expect(preorder.friction).toEqual({
      availability: "pre-order",
      expectedShipDate: "2026-11-01",
      braceletUpchargeUsd: 189,
    });
    expect(preorder.friction && "brandLiquidity" in preorder.friction).toBe(false);
  });

  it("sanitizes implausible extracted dimensions", () => {
    const details = toExtractedDetails(
      makeExtraction({ specs: { caseDiameterMm: 38.9, caseThicknessMm: 38.9 } as never })
    );
    expect(details.specs.caseThicknessMm).toBeUndefined();
    expect(details.specs.caseDiameterMm).toBe(38.9);
  });
});
