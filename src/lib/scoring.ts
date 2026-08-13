import { Money, Watch } from "./types";
import {
  CATEGORY_EXPECTATION,
  Dimension,
  DIMENSIONS,
  PriceBand,
  priceBandFor,
  RubricCategory,
  RubricReference,
  rubricFor,
} from "./rubrics";

export type { Dimension } from "./rubrics";

// ---------------------------------------------------------------------------
// Design score and quadrant placement.
//
// The subjective half of the model: your own read on how a watch looks. The
// standing engine below deliberately has no view on it, so the two are
// combined only at the point of display.
// ---------------------------------------------------------------------------

export type Quadrant = "buy" | "aspirational" | "sensible" | "skip";

export interface ScoreThresholds {
  value: number;
  design: number;
}

/** Bounds of the 1-5 design rank. */
export const DESIGN_RANK_MIN = 1;
export const DESIGN_RANK_MAX = 5;

// Tuning knob: currency conversion rates used before scoring.
export const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CHF: 1.12,
  JPY: 0.0064,
};

export function normalizePriceToUsd(money: Money, onWarning?: (message: string) => void): number {
  const currency = money.currency.trim().toUpperCase();
  const rate = CURRENCY_TO_USD[currency];
  if (rate === undefined) {
    onWarning?.(`Unknown currency ${currency}; using a 1.0 USD conversion rate.`);
    return money.amount;
  }
  return money.amount * rate;
}

/**
 * Your 1-5 design rank as a 0-100 score, or null when you have not ranked it.
 *
 * This replaces a weighted desirability score whose three inputs did not hold
 * up. Brand reputation was a constant — every brand in data/brands.json sits at
 * reputationTier 3 — so its 35% contributed no variance. Wishlist tier is the
 * judgement the matrix exists to inform, so feeding it back in at 25% made the
 * chart partly restate its own input. Design was the only live term, and for
 * the watches without a design rank the score collapsed to exactly five
 * values, one per wishlist tier.
 *
 * Unranked returns null rather than a neutral 3: a neutral fill would park
 * every unranked watch on the median line and read as an opinion never given.
 */
export function computeDesignScore(watch: Watch): number | null {
  const rank = watch.designUniqueness;
  if (typeof rank !== "number" || !Number.isInteger(rank)) return null;
  if (rank < DESIGN_RANK_MIN || rank > DESIGN_RANK_MAX) return null;
  return ((rank - DESIGN_RANK_MIN) / (DESIGN_RANK_MAX - DESIGN_RANK_MIN)) * 100;
}

/** Median of the supplied scores. Callers pass only the watches scored on that axis. */
export function medianScore(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** A watch needs both axes to be placed; either one missing means no quadrant. */
export function assignQuadrant(
  valueScore: number | null,
  designScore: number | null,
  thresholds: ScoreThresholds
): Quadrant | null {
  if (valueScore === null || designScore === null) return null;
  const highValue = valueScore >= thresholds.value;
  const highDesign = designScore >= thresholds.design;
  if (highValue && highDesign) return "buy";
  if (!highValue && highDesign) return "aspirational";
  if (highValue && !highDesign) return "sensible";
  return "skip";
}

// ---------------------------------------------------------------------------
// Peer-band standing engine.
//
// Five dimensions scored 0-1 against the fixed rubrics in ./rubrics.ts.
// A dimension with missing source data is undefined, never a fabricated
// mid value, and is excluded from the composite. Friction flags are surfaced
// as text and never enter any numeric score.
// ---------------------------------------------------------------------------

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Caliber quality tiers, matched as substrings against the normalized caliber
// string so catalog phrasing like "Automatic Cal. Miyota 9075 GMT" still
// resolves. Order matters: more specific patterns first. Extend as watches are
// added. Unknown calibers return undefined — they do NOT fall back to a mid value.
const CALIBER_TIER_PATTERNS: Array<[pattern: string, tier: number]> = [
  ["co-axial master chronometer 8800", 0.95],
  ["mt5450", 0.80],
  ["m100", 0.80],
  ["sw510", 0.72],
  ["l688", 0.72],
  ["st-1901b", 0.70],
  ["soprod c125", 0.68],
  ["l888", 0.65],
  ["sw300", 0.65],
  ["la joux-perret", 0.65],
  ["miyota 9075", 0.62],
  ["powermatic 80", 0.60],
  ["rw3230", 0.60],
  ["peseux 7001", 0.60],
  ["sw200-1", 0.58],
  ["sw200", 0.55],
  ["miyota 9015", 0.55],
  ["miyota 9039", 0.55],
  ["9039", 0.55],
  ["france ebauche", 0.45],
  ["nh38", 0.35],
  ["nh34", 0.32],
  ["nh35", 0.30],
  ["meca-quartz", 0.30],
  ["ronda 1032", 0.20],
];

/** Base movement tier for a caliber string, or undefined when unrecognized. */
export function caliberTier(caliber: string | undefined): number | undefined {
  const key = caliber?.toLowerCase().trim();
  if (!key) return undefined;
  return CALIBER_TIER_PATTERNS.find(([pattern]) => key.includes(pattern))?.[1];
}

/** First tag that maps to a rubric category; unrecognized/untagged falls back to "dress". */
export function deriveCategory(watch: Watch): RubricCategory {
  for (const tag of watch.tags ?? []) {
    const normalized = tag.trim().toLowerCase();
    if (normalized === "diver") return "diver";
    if (normalized === "chronograph") return "chronograph";
    if (normalized === "gmt" || normalized === "worldtimer") return "gmt";
    if (normalized === "dress") return "dress";
  }
  return "dress";
}

/** All-in USD price used for banding: landedPrice when present, else price. */
export function landedPriceUsd(watch: Watch, onWarning?: (message: string) => void): number | undefined {
  const money = watch.landedPrice ?? watch.price;
  return money ? normalizePriceToUsd(money, onWarning) : undefined;
}

/** qualityFlags each dimension reads. A dimension is rated only if at least one is recorded. */
const CASE_CRAFT_FLAGS = ["hardenedCoatingHv", "sapphireBezelInsert", "drilledLugs", "arLayers"] as const;
const BRACELET_FLAGS = ["braceletIncluded", "microAdjustClasp", "quickRelease"] as const;

/**
 * Raw dimension scores against fixed anchors. Any dimension lacking source
 * data returns undefined, not a number:
 * - movement needs a recognized caliber
 * - wearability needs both diameter and thickness
 * - caseCraft and bracelet each need one of their own qualityFlags recorded
 * - durability needs a water-resistance rating
 */
export function scoreDimensions(watch: Watch): Partial<Record<Dimension, number>> {
  const s = watch.specs ?? {};
  const f = watch.qualityFlags ?? {};
  const expectation = CATEGORY_EXPECTATION[deriveCategory(watch)];

  const out: Partial<Record<Dimension, number>> = {};

  const caliberBase = caliberTier(s.caliber);
  if (caliberBase !== undefined) {
    // Regulation is expensive and almost nobody at this price point does it.
    const regBonus = f.regulatedPositions ? Math.min(0.2, f.regulatedPositions * 0.05) : 0;
    const prBonus =
      s.powerReserveHours !== undefined ? clamp01((s.powerReserveHours - 38) / 42) * 0.1 : 0;
    out.movement = clamp01(caliberBase + regBonus + prBonus);
  }

  if (s.caseDiameterMm !== undefined && s.caseDiameterMm > 0 && s.caseThicknessMm !== undefined) {
    // Thickness-to-diameter ratio: ~0.26 wears excellently, ~0.36 is chunky.
    const ratio = s.caseThicknessMm / s.caseDiameterMm;
    out.wearability = clamp01((0.36 - ratio) / 0.10);
  }

  // Each of these needs its own source data. Gating both on "any qualityFlags
  // at all" scored a watch that had only, say, an accuracy spec recorded as
  // though its case had no hardening, no sapphire bezel and no drilled lugs.
  // For caseCraft that fabricated score was the 0.35 base, which sits below
  // every band's rubric reference, so the watch was guaranteed to trail on a
  // dimension nobody had measured.
  if (CASE_CRAFT_FLAGS.some((flag) => f[flag] !== undefined)) {
    out.caseCraft = clamp01(
      0.35 +
        (f.hardenedCoatingHv ? 0.2 : 0) +
        (f.sapphireBezelInsert ? 0.15 : 0) +
        (f.drilledLugs ? 0.1 : 0) +
        (Math.min(f.arLayers ?? 0, 8) / 8) * 0.2
    );
  }

  // A watch sold on a strap has no bracelet to judge, so the dimension is not
  // applicable rather than bad. Scoring it 0 against a 0.40-0.85 rubric
  // expectation conflated "no bracelet offered" with "poor bracelet", and
  // double-counted a concern the model deliberately keeps out of the numbers:
  // friction.braceletUpchargeUsd already surfaces the cost of adding one, as
  // text. Not applicable is distinct from not recorded, but both mean the
  // dimension should stay out of the composite.
  if (f.braceletIncluded !== false && BRACELET_FLAGS.some((flag) => f[flag] !== undefined)) {
    out.bracelet = clamp01(
      (f.braceletIncluded ? 0.4 : 0) +
        (f.microAdjustClasp ? 0.35 : 0) +
        (f.quickRelease ? 0.25 : 0)
    );
  }

  if (s.waterResistanceM !== undefined) {
    out.durability = clamp01(
      0.5 * clamp01(s.waterResistanceM / expectation.wrM) +
        0.25 * ((s.crystal ?? "").toLowerCase().includes("sapphire") ? 1 : 0) +
        0.25 * clamp01((f.antimagneticAm ?? 0) / 25000)
    );
  }

  return out;
}

export interface PeerGroup {
  category: RubricCategory;
  band?: PriceBand;
  /** Display context, e.g. "divers, $500-1000". */
  label: string;
  /** Watches sharing category and band, including the subject watch. */
  members: Watch[];
}

const CATEGORY_PLURAL: Record<RubricCategory, string> = {
  diver: "divers",
  chronograph: "chronographs",
  gmt: "GMTs",
  dress: "dress",
};

/** Peer group = same rubric category + same price band. Unpriced watches group together. */
export function derivePeerGroup(watch: Watch, allWatches: Watch[]): PeerGroup {
  const category = deriveCategory(watch);
  const usd = landedPriceUsd(watch);
  const band = usd !== undefined ? priceBandFor(usd) : undefined;

  const members = allWatches.filter((candidate) => {
    if (deriveCategory(candidate) !== category) return false;
    const candidateUsd = landedPriceUsd(candidate);
    if (band === undefined) return candidateUsd === undefined;
    return candidateUsd !== undefined && priceBandFor(candidateUsd).id === band.id;
  });

  return {
    category,
    band,
    label: `${CATEGORY_PLURAL[category]}, ${band ? band.label : "unpriced"}`,
    members: members.some((member) => member.id === watch.id) ? members : [...members, watch],
  };
}

/** Percentile within pool (0-1). Use ONLY when pool.length >= 6. */
export function percentile(value: number, pool: number[]): number | undefined {
  if (pool.length < 6) return undefined;
  const below = pool.filter((p) => p < value).length;
  return below / (pool.length - 1);
}

// Rated dimensions must diverge from the rubric reference by more than this
// before a watch is said to beat or trail the band.
export const RUBRIC_TOLERANCE = 0.05;

// How strongly within-band price position tilts the value score.
export const VALUE_PRICE_TILT = 0.3;

export interface Standing {
  peerLabel: string;
  peerCount: number;
  /**
   * Per rated dimension: the score, the band it was scored against, and that
   * band's rubric reference. `reference` is undefined only for an unbanded
   * watch, i.e. one with no price.
   */
  dimensions: Partial<Record<Dimension, { raw: number; rubricBand: string; reference?: number }>>;
  /** Dimensions with missing source data — display "unrated", never 0. */
  unrated: Dimension[];
  /** Composite of rated dimensions only. Undefined when nothing is rated. */
  qualityScore?: number;
  /** Quality relative to landed price within the band. Needs a price and a rated dimension. */
  valueScore?: number;
  /** Rank of qualityScore within the peer group; only when the group has n >= 6. */
  qualityPercentile?: number;
  /** Dimensions above the band's rubric reference. */
  beats: Dimension[];
  /** Dimensions below the band's rubric reference. */
  trails: Dimension[];
  /** Human-readable friction chips. Never numeric, never part of any score. */
  frictions: string[];
}

function compositeQuality(raw: Partial<Record<Dimension, number>>): number | undefined {
  const rated = DIMENSIONS.flatMap((dimension) => {
    const value = raw[dimension];
    return value === undefined ? [] : [value];
  });
  if (rated.length === 0) return undefined;
  return rated.reduce((sum, value) => sum + value, 0) / rated.length;
}

function frictionChips(watch: Watch): string[] {
  const friction = watch.friction;
  if (!friction) return [];

  const chips: string[] = [];
  if (friction.availability === "pre-order") {
    chips.push(
      friction.expectedShipDate
        ? `pre-order, ships ${friction.expectedShipDate}`
        : "pre-order"
    );
  } else if (friction.availability === "sold-out") {
    chips.push("sold out");
  } else if (friction.availability === "discontinued") {
    chips.push("discontinued");
  }
  if (friction.braceletUpchargeUsd) {
    chips.push(`bracelet +$${friction.braceletUpchargeUsd}`);
  }
  if (friction.brandLiquidity <= 2) {
    chips.push("thin secondary market");
  }
  return chips;
}

/**
 * Full peer-band standing for one watch. Scores come from the fixed rubric for
 * the watch's category and price band; the peer group contributes only the
 * label, the count, and (when n >= 6) a percentile.
 */
export function computeStanding(watch: Watch, allWatches: Watch[]): Standing {
  const peerGroup = derivePeerGroup(watch, allWatches);
  const raw = scoreDimensions(watch);
  const usd = landedPriceUsd(watch);
  const band = peerGroup.band;
  const rubric: RubricReference | undefined = band
    ? rubricFor(peerGroup.category, band.id)
    : undefined;

  const dimensions: Standing["dimensions"] = {};
  const beats: Dimension[] = [];
  const trails: Dimension[] = [];
  for (const dimension of DIMENSIONS) {
    const value = raw[dimension];
    if (value === undefined) continue;
    dimensions[dimension] = {
      raw: value,
      rubricBand: band?.id ?? "unbanded",
      reference: rubric?.[dimension],
    };
    if (rubric) {
      if (value > rubric[dimension] + RUBRIC_TOLERANCE) beats.push(dimension);
      else if (value < rubric[dimension] - RUBRIC_TOLERANCE) trails.push(dimension);
    }
  }

  const qualityScore = compositeQuality(raw);

  // Par quality at the band's midpoint price scores 0.5: beating the rubric on
  // the rated dimensions raises it, sitting cheap within the band raises it.
  // The reference composite averages only the dimensions actually rated, so a
  // partially-rated watch is compared like-for-like.
  let valueScore: number | undefined;
  if (qualityScore !== undefined && rubric && band && usd !== undefined) {
    const ratedDimensions = DIMENSIONS.filter((dimension) => raw[dimension] !== undefined);
    const referenceQuality =
      ratedDimensions.reduce((sum, dimension) => sum + rubric[dimension], 0) /
      ratedDimensions.length;
    const pricePosition = clamp01((usd - band.minUsd) / (band.maxUsd - band.minUsd));
    valueScore = clamp01(
      0.5 + (qualityScore - referenceQuality) - VALUE_PRICE_TILT * (pricePosition - 0.5)
    );
  }

  // Optional peer-relative rank, only meaningful once the group is big enough.
  let qualityPercentile: number | undefined;
  if (qualityScore !== undefined) {
    const pool = peerGroup.members.flatMap((member) => {
      const memberQuality = compositeQuality(scoreDimensions(member));
      return memberQuality === undefined ? [] : [memberQuality];
    });
    qualityPercentile = percentile(qualityScore, pool);
  }

  return {
    peerLabel: peerGroup.label,
    peerCount: peerGroup.members.length,
    dimensions,
    unrated: DIMENSIONS.filter((dimension) => raw[dimension] === undefined),
    qualityScore,
    valueScore,
    qualityPercentile,
    beats,
    trails,
    frictions: frictionChips(watch),
  };
}

/**
 * Why a dimension came back unrated, phrased for display. Keeps the UI honest
 * about which input is missing instead of showing a bare dash. Mirrors the
 * gates in scoreDimensions — if those change, these strings must follow.
 */
export function unratedReason(watch: Watch, dimension: Dimension): string {
  const s = watch.specs ?? {};
  const f = watch.qualityFlags ?? {};
  switch (dimension) {
    case "movement":
      return s.caliber ? `Caliber "${s.caliber}" is not in the tier table` : "No caliber recorded";
    case "wearability":
      if (s.caseDiameterMm === undefined && s.caseThicknessMm === undefined)
        return "No case dimensions recorded";
      return s.caseThicknessMm === undefined ? "No case thickness recorded" : "No case diameter recorded";
    case "caseCraft":
      return "No finishing details recorded";
    case "bracelet":
      if (f.braceletIncluded === false) return "Ships on a strap — no bracelet to rate";
      return "No bracelet hardware recorded";
    case "durability":
      return "No water resistance recorded";
  }
}

/**
 * What the UI renders per watch: the objective peer-band standing plus the
 * subjective desire score, which the standing engine deliberately has no view
 * on. Plain data so it can cross the server/client boundary.
 */
export interface StandingSummary {
  standing: Standing;
  /** Your design rank as 0-100, or null when the watch is unranked. */
  designScore: number | null;
}

/**
 * Par on the 0-1 standing scales. A watch at exactly the rubric reference for
 * its category and band scores 0.5, so the split is an absolute reference and
 * does not move with the contents of the collection.
 */
export const PAR_SCORE = 0.5;

/** Standing scores are 0-1; the UI shows them on the same 0-100 scale as desire. */
export const toDisplayScore = (score: number): number => score * 100;

/**
 * Standings for `watches`, keyed by id. Peer groups are drawn from `pool`, so
 * pass the full collection even when only rendering a subset — a bigger pool
 * means better peer labels and more groups clearing the n >= 6 percentile bar.
 */
export function standingSummaries(watches: Watch[], pool: Watch[]): Record<string, StandingSummary> {
  return Object.fromEntries(
    watches.map((watch) => [
      watch.id,
      { standing: computeStanding(watch, pool), designScore: computeDesignScore(watch) },
    ])
  );
}
