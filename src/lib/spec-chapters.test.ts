import { describe, expect, it } from "vitest";
import { KEY_SPEC_KEYS, QUALITY_FLAG_FIELDS, SPEC_FIELDS, keySpecs, specChapters } from "./specs";

describe("key-spec strip", () => {
  it("keeps strip order and leaves out what is not recorded", () => {
    const rows = keySpecs({ caliber: "SW200-1", caseDiameterMm: 40, waterResistanceM: 200, caseThicknessMm: undefined });
    expect(rows.map((r) => r.key)).toEqual(["caseDiameterMm", "waterResistanceM", "caliber"]);
    expect(rows[0].value).toBe("40 mm");
  });

  it("treats a blank string as not recorded", () => {
    expect(keySpecs({ caliber: "  " })).toEqual([]);
  });

  it("only names fields that exist in SPEC_FIELDS", () => {
    for (const key of KEY_SPEC_KEYS) expect(SPEC_FIELDS.some((f) => f.key === key)).toBe(true);
  });
});

describe("spec chapters", () => {
  it("accounts for every spec field and quality flag exactly once", () => {
    const chapters = specChapters({ specs: {} });
    const named = chapters.flatMap((c) => c.missing);
    const labels = [...SPEC_FIELDS, ...QUALITY_FLAG_FIELDS].map((f) => f.label);
    expect(named.sort()).toEqual(labels.sort());
    expect(chapters.every((c) => c.rows.length === 0)).toBe(true);
  });

  it("renders a flag recorded as false as a row, not as missing", () => {
    // A recorded absence and no record are different facts; collapsing them
    // is the same mistake the scoring engine guards against.
    const strap = specChapters({ specs: {}, qualityFlags: { braceletIncluded: false } }).find((c) => c.id === "strap")!;
    expect(strap.rows).toEqual([{ key: "braceletIncluded", label: "Bracelet included", value: "No" }]);
    expect(strap.missing).not.toContain("Bracelet included");
  });

  it("formats numeric flags with their unit", () => {
    const movement = specChapters({ specs: {}, qualityFlags: { antimagneticAm: 15000 } }).find((c) => c.id === "movement")!;
    expect(movement.rows.find((r) => r.key === "antimagneticAm")?.value).toBe("15,000 A/m");
  });

  it("keeps a recorded zero", () => {
    const movement = specChapters({ specs: {}, qualityFlags: { regulatedPositions: 0 } }).find((c) => c.id === "movement")!;
    expect(movement.rows.find((r) => r.key === "regulatedPositions")?.value).toBe("0");
  });
});
