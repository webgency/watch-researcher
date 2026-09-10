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
  caseCraft: "case features",
  wearability: "case profile",
  durability: "durability",
  bracelet: "bracelet",
};

/** What each dimension actually reads, for tooltips and detail views. */
export const DIMENSION_BLURBS: Record<Dimension, string> = {
  movement: "Caliber tier, plus regulation and power reserve.",
  caseCraft: "Recorded case hardware and treatments: hardening, sapphire bezel insert, drilled lugs, and AR layers. This does not rate visual finishing quality.",
  wearability: "Objective case proportions from diameter, thickness, and—when recorded—lug-to-lug. Personal fit is rated separately.",
  durability: "Water resistance against what the category needs, plus crystal and antimagnetism.",
  bracelet: "Bracelet hardware: whether one is included, micro-adjust clasp, quick-release.",
};

/** Categories the rubric knows about. Watches whose tags match none stay unrated. */
import { RUBRIC_CATEGORIES as RUBRIC_CATEGORY_LIST } from "./rubric-categories.mjs";
import type { ScoringCategory } from "./types";

export type RubricCategory = ScoringCategory;

// Imported rather than restated so scripts/audit-data.mjs, which runs under
// bare Node, reads the same list the type system checks RUBRICS against.
export const RUBRIC_CATEGORIES: RubricCategory[] = RUBRIC_CATEGORY_LIST as RubricCategory[];

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

/** Midpoints anchor the established rubric judgments without preserving cliffs at their edges. */
export const PRICE_ANCHORS_USD = PRICE_BANDS.map((band) => (band.minUsd + band.maxUsd) / 2);

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
  // Field and everyday sports watches: enough to swim in, well short of what a
  // diver is held to. The same 100m bar as gmt, because the requirement is the
  // same one — survive water without being a dive instrument.
  sports: { wrM: 100, needsBezel: false, needsScrewCrown: false },
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
  // Field and everyday sports watches — the category for a watch that is
  // neither a diver nor a dress watch, which was previously graded as one or
  // the other and misread both times. Each column is set against a neighbour
  // that already has a defensible number, rather than invented:
  //
  // - movement is a touch above diver. A plain three-hander carries no chrono
  //   module, no GMT hand and no dive bezel assembly, so more of the same
  //   money reaches the caliber. Not as high as that sounds: the gap is one
  //   step, not a tier.
  // - caseCraft matches every other category, which the table already treats
  //   as scaling with price rather than with what the watch is for.
  // - wearability sits between gmt and dress. There is no dive-case bulk to
  //   forgive, but no dress-watch obligation to be thin either.
  // - durability matches gmt exactly, because both are judged against the same
  //   100m bar and read the same three inputs. A higher reference would score
  //   two watches with identical specs differently for no measurable reason.
  // - bracelet matches chronograph. A sports watch ships on a strap about as
  //   often as not, so unlike a diver the bracelet is not part of the
  //   category's identity and par should not assume one.
  sports: {
    "under-500": { movement: 0.32, caseCraft: 0.35, wearability: 0.45, durability: 0.55, bracelet: 0.35 },
    "500-1000": { movement: 0.48, caseCraft: 0.40, wearability: 0.50, durability: 0.60, bracelet: 0.45 },
    "1000-2000": { movement: 0.60, caseCraft: 0.45, wearability: 0.55, durability: 0.65, bracelet: 0.55 },
    "2000-5000": { movement: 0.70, caseCraft: 0.52, wearability: 0.60, durability: 0.70, bracelet: 0.65 },
    "5000-plus": { movement: 0.85, caseCraft: 0.60, wearability: 0.65, durability: 0.75, bracelet: 0.75 },
  },
};

export function rubricFor(category: RubricCategory, bandId: PriceBandId): RubricReference {
  return RUBRICS[category][bandId];
}

/**
 * Price expectation interpolated between the established rubric midpoints.
 * Log-price interpolation treats proportional price changes consistently and
 * makes the reference continuous across display-band boundaries. Prices below
 * and above the anchor range use the nearest established reference.
 */
export function continuousReference(
  category: RubricCategory,
  dimension: Dimension,
  priceUsd: number
): number {
  if (priceUsd <= PRICE_ANCHORS_USD[0]) return RUBRICS[category][PRICE_BANDS[0].id][dimension];
  const last = PRICE_ANCHORS_USD.length - 1;
  if (priceUsd >= PRICE_ANCHORS_USD[last]) return RUBRICS[category][PRICE_BANDS[last].id][dimension];

  const rightIndex = PRICE_ANCHORS_USD.findIndex((anchor) => priceUsd < anchor);
  const leftIndex = rightIndex - 1;
  const leftPrice = PRICE_ANCHORS_USD[leftIndex];
  const rightPrice = PRICE_ANCHORS_USD[rightIndex];
  const fraction = (Math.log(priceUsd) - Math.log(leftPrice)) / (Math.log(rightPrice) - Math.log(leftPrice));
  const left = RUBRICS[category][PRICE_BANDS[leftIndex].id][dimension];
  const right = RUBRICS[category][PRICE_BANDS[rightIndex].id][dimension];
  return left + (right - left) * fraction;
}
