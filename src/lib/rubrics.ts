// Fixed rubric reference data for the peer-band standing engine.
//
// Peer groups in this dataset are small (typically 2-4 watches), so dimensions
// are scored against hardcoded per-category, per-price-band reference values
// instead of percentiles. Peer groups survive only for the display label and
// for filtering; percentile ranking is applied only when a group has n >= 6.

export type Dimension =
  | "movement"
  | "caseCraft"
  | "wearability"
  | "durability"
  | "bracelet";

export const DIMENSIONS: Dimension[] = [
  "movement",
  "caseCraft",
  "wearability",
  "durability",
  "bracelet",
];

/** Display names for the scored dimensions. */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  movement: "movement",
  caseCraft: "case & finishing",
  wearability: "wearability",
  durability: "durability",
  bracelet: "bracelet",
};

/** What each dimension actually reads, for tooltips and detail views. */
export const DIMENSION_BLURBS: Record<Dimension, string> = {
  movement: "Caliber tier, plus regulation and power reserve.",
  caseCraft: "Finishing and case hardware: coatings, bezel insert, drilled lugs, AR layers.",
  wearability: "Thickness against what the diameter should cost — how the case sits on a wrist.",
  durability: "Water resistance against what the category needs, plus crystal and antimagnetism.",
  bracelet: "Bracelet hardware: whether one is included, micro-adjust clasp, quick-release.",
};

/** Categories the rubric knows about. Watches whose tags match none fall back to "dress". */
export type RubricCategory = "diver" | "chronograph" | "gmt" | "dress";

export const RUBRIC_CATEGORIES: RubricCategory[] = ["diver", "chronograph", "gmt", "dress"];

export type PriceBandId =
  | "under-500"
  | "500-1000"
  | "1000-2000"
  | "2000-5000"
  | "5000-plus";

export interface PriceBand {
  id: PriceBandId;
  /** Display label, e.g. "$500-1000". */
  label: string;
  minUsd: number;
  /**
   * Upper edge used for banding and for positioning a price within the band.
   * The top band is open-ended for membership; its maxUsd only anchors the
   * within-band price position.
   */
  maxUsd: number;
}

export const PRICE_BANDS: PriceBand[] = [
  { id: "under-500", label: "under $500", minUsd: 0, maxUsd: 500 },
  { id: "500-1000", label: "$500-1000", minUsd: 500, maxUsd: 1000 },
  { id: "1000-2000", label: "$1000-2000", minUsd: 1000, maxUsd: 2000 },
  { id: "2000-5000", label: "$2000-5000", minUsd: 2000, maxUsd: 5000 },
  { id: "5000-plus", label: "$5000+", minUsd: 5000, maxUsd: 12000 },
];

/** Band containing a USD price. Prices above the last band's edge stay in the last band. */
export function priceBandFor(usd: number): PriceBand {
  return PRICE_BANDS.find((band) => usd < band.maxUsd) ?? PRICE_BANDS[PRICE_BANDS.length - 1];
}

/**
 * Fitness-for-purpose expectations, so a 50m dress watch is not penalised for
 * failing to be a diver. Water resistance is scored against wrM, not raw maximums.
 */
export const CATEGORY_EXPECTATION: Record<
  RubricCategory,
  { wrM: number; needsBezel: boolean; needsScrewCrown: boolean }
> = {
  diver: { wrM: 200, needsBezel: true, needsScrewCrown: true },
  chronograph: { wrM: 50, needsBezel: false, needsScrewCrown: false },
  gmt: { wrM: 100, needsBezel: false, needsScrewCrown: false },
  dress: { wrM: 30, needsBezel: false, needsScrewCrown: false },
};

/** "Par" raw score (0-1) per dimension for a category + price band. */
export type RubricReference = Record<Dimension, number>;

// Anchors, roughly:
// - movement: what caliber tier the band's money should buy (NH35 ~0.30,
//   Miyota 9x ~0.55, SW200-1 ~0.58, SW510/L688 ~0.72, manufacture/METAS ~0.80+).
// - wearability: raw score 0.5 corresponds to a case of expected thickness for
//   its diameter — 12.4mm at 40mm, 11.9mm at 37mm, 13.0mm at 44mm — with each
//   further millimetre worth 0.25. Divers get a lower reference (thickness is
//   the cost of the WR), dress watches a higher one. These references predate
//   the diameter-aware formula and still hold: it was pinned to leave the 40mm
//   case exactly where the old thickness/diameter ratio of 0.31 put it.
// - durability: divers are expected to clear their 200m bar with sapphire;
//   dress watches only need to survive a sleeve.
// - caseCraft/bracelet: finishing and clasp hardware expectations scale with
//   price more than with category.
//
// caseCraft is anchored to what its formula can express, not to an ideal.
// scoreDimensions starts it at 0.35 and adds only for a hardened coating, a
// sapphire bezel insert, drilled lugs, and AR layers — four details brands
// rarely publish. Anchoring par above the 0.35 base meant a watch trailed the
// moment any one of them was recorded, however good it is: recording only
// "the bezel is not sapphire" scored 0.35 against a 0.70 reference and read
// as a measured failure rather than an absence of evidence. Par now starts at
// the base and rises with the band, so beating it takes a marker actually
// found rather than all four at once.
export const RUBRICS: Record<RubricCategory, Record<PriceBandId, RubricReference>> = {
  diver: {
    "under-500": { movement: 0.30, caseCraft: 0.35, wearability: 0.35, durability: 0.70, bracelet: 0.40 },
    "500-1000": { movement: 0.45, caseCraft: 0.40, wearability: 0.40, durability: 0.80, bracelet: 0.55 },
    "1000-2000": { movement: 0.58, caseCraft: 0.45, wearability: 0.45, durability: 0.85, bracelet: 0.65 },
    "2000-5000": { movement: 0.68, caseCraft: 0.52, wearability: 0.50, durability: 0.90, bracelet: 0.75 },
    "5000-plus": { movement: 0.85, caseCraft: 0.60, wearability: 0.55, durability: 0.95, bracelet: 0.85 },
  },
  chronograph: {
    "under-500": { movement: 0.28, caseCraft: 0.35, wearability: 0.40, durability: 0.45, bracelet: 0.35 },
    "500-1000": { movement: 0.40, caseCraft: 0.40, wearability: 0.45, durability: 0.50, bracelet: 0.45 },
    "1000-2000": { movement: 0.55, caseCraft: 0.45, wearability: 0.50, durability: 0.55, bracelet: 0.55 },
    "2000-5000": { movement: 0.70, caseCraft: 0.52, wearability: 0.55, durability: 0.60, bracelet: 0.65 },
    "5000-plus": { movement: 0.85, caseCraft: 0.60, wearability: 0.60, durability: 0.65, bracelet: 0.75 },
  },
  gmt: {
    "under-500": { movement: 0.32, caseCraft: 0.35, wearability: 0.40, durability: 0.55, bracelet: 0.40 },
    "500-1000": { movement: 0.50, caseCraft: 0.40, wearability: 0.45, durability: 0.60, bracelet: 0.50 },
    "1000-2000": { movement: 0.60, caseCraft: 0.45, wearability: 0.50, durability: 0.65, bracelet: 0.60 },
    "2000-5000": { movement: 0.68, caseCraft: 0.52, wearability: 0.55, durability: 0.70, bracelet: 0.70 },
    "5000-plus": { movement: 0.85, caseCraft: 0.60, wearability: 0.60, durability: 0.75, bracelet: 0.80 },
  },
  dress: {
    "under-500": { movement: 0.30, caseCraft: 0.35, wearability: 0.55, durability: 0.40, bracelet: 0.30 },
    "500-1000": { movement: 0.45, caseCraft: 0.40, wearability: 0.60, durability: 0.45, bracelet: 0.35 },
    "1000-2000": { movement: 0.55, caseCraft: 0.45, wearability: 0.65, durability: 0.50, bracelet: 0.40 },
    "2000-5000": { movement: 0.65, caseCraft: 0.52, wearability: 0.70, durability: 0.55, bracelet: 0.50 },
    "5000-plus": { movement: 0.82, caseCraft: 0.60, wearability: 0.75, durability: 0.60, bracelet: 0.60 },
  },
};

export function rubricFor(category: RubricCategory, bandId: PriceBandId): RubricReference {
  return RUBRICS[category][bandId];
}
