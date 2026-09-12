// Physical plausibility bounds for watch specs, in one place.
//
// Three consumers need the same numbers and none of them can share a
// TypeScript module: extract.ts drops implausible readings on the way in,
// scripts/backfill-specs.mjs reuses that rule, and scripts/validate-data.mjs
// enforces it against what is already on disk. Plain .mjs is the one format
// all three can import, so the bounds live here rather than being copied.

/** Inclusive [min, max] for each spec, in the spec's own unit. */
export const SPEC_RANGES = {
  caseDiameterMm: [16, 60],
  caseThicknessMm: [3, 25],
  lugToLugMm: [20, 70],
  lugWidthMm: [8, 30],
  waterResistanceM: [10, 2000],
  powerReserveHours: [24, 400],
};

/**
 * Cushion and rectangular cases can measure slightly less lug-to-lug than
 * across (e.g. Dennison ALD: 37mm wide, 35.6mm lug-to-lug), so only a value
 * well under the diameter indicates a swap or misread.
 */
export const LUG_TO_LUG_MIN_RATIO = 0.85;

export function inSpecRange(key, value) {
  const range = SPEC_RANGES[key];
  if (!range) return true;
  return Number.isFinite(value) && value >= range[0] && value <= range[1];
}
