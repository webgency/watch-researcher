import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CANONICAL_CALIBERS,
  isKnownCaliber,
  isQuartzMovement,
  normalizeCaliber,
} from "./calibers";
import { caliberTier } from "./scoring";
import type { Watch } from "./types";

describe("normalizeCaliber", () => {
  it("returns undefined for nothing recorded", () => {
    expect(normalizeCaliber(undefined)).toBeUndefined();
    expect(normalizeCaliber("")).toBeUndefined();
    expect(normalizeCaliber("   ")).toBeUndefined();
  });

  it("strips parentheticals and vendor prefixes down to the canonical key", () => {
    expect(normalizeCaliber("Sellita SW200-1 (COSC)")).toBe("sw200-1");
    expect(normalizeCaliber("Seiko NH35")).toBe("nh35");
    expect(normalizeCaliber("Seiko/TMI NH35 (NH35A)")).toBe("nh35");
    expect(normalizeCaliber("Premium Miyota 9015")).toBe("miyota 9015");
    expect(normalizeCaliber("Peseux 7001 (reworked)")).toBe("peseux 7001");
  });

  it("drops trailing prose after a comma", () => {
    // "ETA (Peseux) 7001, elaboré grade" — the grade is not part of the caliber.
    expect(normalizeCaliber("ETA (Peseux) 7001, elaboré grade")).toBe("7001");
  });

  it("resolves grade suffixes that substring matching would miss", () => {
    expect(normalizeCaliber("Sellita SW510 BH M")).toBe("sw510");
    expect(normalizeCaliber("Sellita SW510 M BH b")).toBe("sw510");
    expect(normalizeCaliber("Soprod C125 GMT")).toBe("soprod c125");
  });

  it("prefers the more specific key when two would match", () => {
    // "sw200-1" is listed before "sw200"; the reverse would flatten every
    // SW200-1 into the plain SW200 and understate a whole band of watches.
    expect(normalizeCaliber("Sellita SW200-1")).toBe("sw200-1");
    expect(normalizeCaliber("Sellita SW200")).toBe("sw200");
  });

  it("returns the cleaned string when no canonical key matches", () => {
    // Unknown, but recorded — distinguishable from nothing recorded at all.
    expect(normalizeCaliber("MU 9419")).toBe("mu 9419");
    expect(isKnownCaliber("MU 9419")).toBe(false);
  });

  it("leaves quartz unrated rather than rating it low", () => {
    // A quartz caliber has no position on a scale anchored on hacking, beat
    // rate and power reserve. Unrated is the honest answer; a low tier would
    // read as a measured failure.
    expect(normalizeCaliber("Ronda 1032", "quartz")).toBeUndefined();
    expect(normalizeCaliber("Seiko VK64 Meca-Quartz", "quartz")).toBeUndefined();
    expect(isKnownCaliber("Ronda 1032", "quartz")).toBe(false);
    expect(isQuartzMovement("solar")).toBe(true);
    expect(isQuartzMovement("automatic")).toBe(false);
    expect(isQuartzMovement(undefined)).toBe(false);
  });

  it("still resolves the same caliber when the movement is mechanical", () => {
    expect(normalizeCaliber("Sellita SW200-1", "automatic")).toBe("sw200-1");
  });
});

describe("caliber vocabulary agrees with the scoring tier table", () => {
  // calibers.mjs owns naming, scoring.ts owns worth. They are separate files
  // because one has to be importable from bare Node, so this asserts they have
  // not drifted: a key added here without a tier there would go silently
  // unrated, which is exactly the failure Phase 0 exists to prevent.
  it("gives every canonical key a tier", () => {
    const untiered = CANONICAL_CALIBERS.filter((key) => caliberTier(key) === undefined);
    expect(untiered).toEqual([]);
  });

  it("agrees with the tier table on every caliber in the collection", () => {
    const raw = JSON.parse(readFileSync(new URL("../../data/watches.json", import.meta.url), "utf8"));
    const watches: Watch[] = Array.isArray(raw) ? raw : raw.watches;
    const disagreements = watches
      .filter((w) => w.specs?.caliber && !isQuartzMovement(w.specs.movement))
      .filter((w) => isKnownCaliber(w.specs.caliber, w.specs.movement) !== (caliberTier(w.specs.caliber) !== undefined))
      .map((w) => `${w.id}: ${w.specs.caliber}`);
    expect(disagreements).toEqual([]);
  });
});
