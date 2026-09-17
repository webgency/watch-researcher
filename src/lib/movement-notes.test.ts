import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { movementNote } from "./movement-notes";
import { isQuartzCaliber } from "./calibers";
import { MECA_QUARTZ_CALIBER_PATTERN } from "./caliber-aliases.mjs";
import { scoreDimensions } from "./scoring";
import type { Watch } from "./types";

function makeWatch(caliber?: string, movement?: Watch["specs"]["movement"]): Watch {
  return {
    id: "t1",
    brand: "Test",
    model: "Test",
    status: "wishlist",
    specs: { caliber, movement },
    tags: [],
    links: [],
    dateAdded: "2026-01-01T00:00:00.000Z",
  };
}

describe("movementNote", () => {
  it("notes the chronograph feel of a meca-quartz caliber", () => {
    for (const caliber of [
      "Meca-quartz Seiko Japan cal. VK63",
      "TMI VK64 Meca-Quartz",
      "hybrid VK68",
      "Mechaquartz",
    ]) {
      expect(movementNote(makeWatch(caliber, "quartz"))?.label).toBe("meca-quartz chrono feel");
    }
  });

  it("says nothing about movements that are not meca-quartz", () => {
    // VH31 sweeps but drives no chronograph module; Ronda 1032 and FC-206 are
    // plain quartz. Unrated with no note is the honest state for all three.
    for (const caliber of ["Seiko VH31", "Ronda 1032", "FC-206", "Seiko NH35", undefined]) {
      expect(movementNote(makeWatch(caliber, "quartz"))).toBeUndefined();
    }
  });

  it("stays FYI: the note never changes a score", () => {
    // The point of the chip is that a deliberately unrated movement still has
    // something worth reading. It must not put the watch back on the scale.
    const watch = makeWatch("Seiko VK64 Meca-Quartz", "quartz");
    expect(movementNote(watch)).toBeDefined();
    expect(scoreDimensions(watch).movement).toBeUndefined();
  });

  it("is not imported by the scoring engine", () => {
    // Structural, not a convention: scoring.ts cannot read a note it never
    // imports, so no later edit there can quietly score one.
    const scoring = readFileSync(new URL("./scoring.ts", import.meta.url), "utf8");
    expect(scoring).not.toContain("movement-notes");
  });

  it("only notes calibers the quartz gate already excludes", () => {
    // A meca-quartz string that QUARTZ_CALIBER_PATTERN missed would be scored
    // on the mechanical scale and carry a note saying it is not.
    for (const caliber of ["Meca-quartz", "Seiko VK64", "mecha quartz", "VK61"]) {
      expect(MECA_QUARTZ_CALIBER_PATTERN.test(caliber)).toBe(true);
      expect(isQuartzCaliber(caliber)).toBe(true);
    }
  });
});

describe("the collection's meca-quartz watches", () => {
  it("all carry the note and none are scored on movement", () => {
    const raw = JSON.parse(readFileSync(new URL("../../data/watches.json", import.meta.url), "utf8"));
    const watches: Watch[] = Array.isArray(raw) ? raw : raw.watches;
    const noted = watches.filter((w) => movementNote(w));
    expect(noted.length).toBeGreaterThan(0);
    expect(noted.filter((w) => scoreDimensions(w).movement !== undefined)).toEqual([]);
  });
});
