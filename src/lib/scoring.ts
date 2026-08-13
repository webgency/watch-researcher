import { Money, QualityFlags, Watch } from "./types";
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

export type Quadrant = "buy" | "aspirational" | "sensible" | "skip";

export interface ScoreThresholds {
  value: number;
  design: number;
}

export interface ThresholdResult {
  thresholds: ScoreThresholds;
  method: "median" | "fixed";
}

export interface DataCompleteness {
  present: number;
  total: number;
  missing: string[];
}

export interface WatchScore {
  watch: Watch;
  valueScore: number | null;
  /** Null until the watch has been ranked for design. Never a neutral fill. */
  designScore: number | null;
  quadrant: Quadrant | null;
  dataCompleteness: DataCompleteness;
}

export interface WatchScoreSummary {
  valueScore: number | null;
  designScore: number | null;
  quadrant: Quadrant | null;
  dataCompleteness: DataCompleteness;
  valueRank: number | null;
}

// Tuning knob: fallback split for tiny collections and flat score ranges.
export const FIXED_THRESHOLD = 50;

// Tuning knob: currency conversion rates used before value scoring.
export const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CHF: 1.12,
  JPY: 0.0064,
};

/** The 1-5 design rank, as a 0-100 score. */
export const DESIGN_RANK_MIN = 1;
export const DESIGN_RANK_MAX = 5;

// Tuning knob: fewer rated watches use a stable fixed split instead of medians.
export const MIN_MEDIAN_THRESHOLD_COUNT = 4;

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
 * The design axis: your own 1-5 rank, rescaled to 0-100, and null when you
 * have not ranked the watch yet.
 *
 * This replaced a composite of design, brand reputation, and wishlist tier.
 * Two of those three were not carrying signal: every brand in the catalogue
 * sits at reputation tier 3, so that term was a constant, and wishlist tier is
 * the very judgement the value matrix exists to inform, so feeding it back in
 * made the chart partly restate its own input. With both removed, the axis is
 * one declared opinion instead of three weights around a constant.
 *
 * Unranked returns null rather than a neutral 3. A neutral fill would park
 * every unranked watch on the median line and read as a real opinion.
 */
export function computeDesignScore(watch: Watch): number | null {
  const rank = watch.designUniqueness;
  if (typeof rank !== "number" || !Number.isInteger(rank)) return null;
  if (rank < DESIGN_RANK_MIN || rank > DESIGN_RANK_MAX) return null;
  return ((rank - DESIGN_RANK_MIN) / (DESIGN_RANK_MAX - DESIGN_RANK_MIN)) * 100;
}

/**
 * How much of the standing is actually evidenced: the dimensions rated out of
 * the five. This used to count the inputs to a separate spec-quality formula;
 * once that formula went away, counting its fields would have reported the
 * completeness of something nothing reads.
 */
export function computeDataCompleteness(standing: Standing): DataCompleteness {
  return {
    present: DIMENSIONS.length - standing.unrated.length,
    total: DIMENSIONS.length,
    missing: standing.unrated.map((dimension) => DIMENSION_LABELS[dimension].toLowerCase()),
  };
}

/**
 * Each axis takes its median from the watches actually scored on that axis, so
 * a half-ranked collection still splits the design axis sensibly instead of
 * being dragged by watches that carry no design opinion at all.
 */
export function computeThresholds(
  scores: Array<{ valueScore: number | null; designScore: number | null }>,
  override?: Partial<ScoreThresholds>
): ThresholdResult {
  const valueRated = scores.map((score) => score.valueScore).filter((score): score is number => score !== null);
  const designRated = scores.map((score) => score.designScore).filter((score): score is number => score !== null);
  const method =
    valueRated.length < MIN_MEDIAN_THRESHOLD_COUNT || designRated.length < MIN_MEDIAN_THRESHOLD_COUNT
      ? "fixed"
      : "median";
  const thresholds =
    method === "fixed"
      ? { value: FIXED_THRESHOLD, design: FIXED_THRESHOLD }
      : { value: median(valueRated), design: median(designRated) };

  return {
    thresholds: { ...thresholds, ...override },
    method,
  };
}

export function assignQuadrant(
  valueScore: number | null,
  designScore: number | null,
  thresholds: ScoreThresholds = { value: FIXED_THRESHOLD, design: FIXED_THRESHOLD }
): Quadrant | null {
  if (valueScore === null || designScore === null) return null;
  const highValue = valueScore >= thresholds.value;
  const highDesign = designScore >= thresholds.design;
  if (highValue && highDesign) return "buy";
  if (!highValue && highDesign) return "aspirational";
  if (highValue && !highDesign) return "sensible";
  return "skip";
}

/**
 * Scores `watches` for the matrix and the cards. Peer bands are drawn from
 * `allWatches`, so an owned watch still counts as a peer for anything priced
 * alongside it even when only the wishlist is being scored.
 *
 * Value is the peer-band standing, rescaled to 0-100. It replaced a separate
 * spec-quality-over-log-price score that ranked the whole collection on one
 * axis regardless of category — that formula marked a dress watch down for its
 * water resistance against divers, and dividing by price meant cheapness
 * dominated. The two engines ranked this collection almost independently
 * (Spearman rho -0.14), so keeping both meant showing two contradictory
 * answers to the same question.
 */
export function computeWatchScores(
  watches: Watch[],
  allWatches: Watch[] = watches,
  onWarning?: (message: string) => void
): { scores: WatchScore[]; thresholds: ScoreThresholds; thresholdMethod: ThresholdResult["method"] } {
  const initialScores = watches.map((watch) => {
    const standing = computeStanding(watch, allWatches, onWarning);
    return {
      watch,
      valueScore: standing.valueScore === undefined ? null : standing.valueScore * 100,
      designScore: computeDesignScore(watch),
      dataCompleteness: computeDataCompleteness(standing),
    };
  });
  const { thresholds, method } = computeThresholds(initialScores);

  return {
    thresholds,
    thresholdMethod: method,
    scores: initialScores.map((score) => ({
      ...score,
      quadrant: assignQuadrant(score.valueScore, score.designScore, thresholds),
    })),
  };
}

export function valueRankings(scores: WatchScore[]): Map<string, number> {
  return new Map(
    scores
      .filter((score): score is WatchScore & { valueScore: number } => score.valueScore !== null)
      .sort(compareValueScores)
      .map((score, index) => [score.watch.id, index + 1])
  );
}

export function watchScoreSummaries(scores: WatchScore[]): Record<string, WatchScoreSummary> {
  const ranks = valueRankings(scores);
  return Object.fromEntries(
    scores.map((score) => [
      score.watch.id,
      {
        valueScore: score.valueScore,
        designScore: score.designScore,
        quadrant: score.quadrant,
        dataCompleteness: score.dataCompleteness,
        valueRank: ranks.get(score.watch.id) ?? null,
      },
    ])
  );
}

export function compareValueScores(a: WatchScore & { valueScore: number }, b: WatchScore & { valueScore: number }): number {
  return (
    b.valueScore - a.valueScore ||
    (b.designScore ?? -Infinity) - (a.designScore ?? -Infinity) ||
    `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`)
  );
}

function median(values: number[]): number {
  if (values.length === 0) return FIXED_THRESHOLD;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Peer-band standing engine (Phase 1).
//
// Five dimensions scored 0-1 against the fixed rubrics in ./rubrics.ts.
// A dimension with missing source data is undefined, never a fabricated
// mid value, and is excluded from the composite.
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
  ["sw330", 0.65],
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

/** USD price used for banding. */
export function priceUsd(watch: Watch, onWarning?: (message: string) => void): number | undefined {
  const money = watch.price;
  return money ? normalizePriceToUsd(money, onWarning) : undefined;
}

/** Flags that carry caseCraft signal. */
const CASE_CRAFT_FLAGS = [
  "hardenedCoatingHv",
  "sapphireBezelInsert",
  "drilledLugs",
  "arLayers",
] as const satisfies readonly (keyof QualityFlags)[];

/**
 * How many caseCraft flags must have been recorded before the dimension is
 * rated. A lone `sapphireBezelInsert: false` is the single most common record
 * in the collection and says nothing about finishing — a dress watch has no
 * bezel to put an insert in. Requiring two recorded flags means "finishing was
 * actually surveyed" rather than "the extractor emitted one default".
 */
const CASE_CRAFT_MIN_FLAGS = 2;

/** The clasp hardware that separates one bracelet from another. */
const BRACELET_HARDWARE_FLAGS = [
  "microAdjustClasp",
  "quickRelease",
] as const satisfies readonly (keyof QualityFlags)[];

function recordedCount(flags: QualityFlags, keys: readonly (keyof QualityFlags)[]): number {
  return keys.filter((key) => flags[key] !== undefined).length;
}

/**
 * Raw dimension scores against fixed anchors. Any dimension lacking source
 * data returns undefined, not a number:
 * - movement needs a recognized caliber
 * - wearability needs both diameter and thickness
 * - caseCraft needs at least CASE_CRAFT_MIN_FLAGS of its flags recorded
 * - bracelet needs a bracelet: a watch sold on a strap has no bracelet to rate
 * - durability needs a water-resistance rating
 *
 * Absence is never scored as zero. A dimension that cannot be evidenced comes
 * back undefined so callers render it "unrated"; `computeStanding` composites
 * and compares only the dimensions actually rated, so a partially-rated watch
 * is still judged like-for-like against the rubric.
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

  if (recordedCount(f, CASE_CRAFT_FLAGS) >= CASE_CRAFT_MIN_FLAGS) {
    out.caseCraft = clamp01(
      0.35 +
        (f.hardenedCoatingHv ? 0.2 : 0) +
        (f.sapphireBezelInsert ? 0.15 : 0) +
        (f.drilledLugs ? 0.1 : 0) +
        (Math.min(f.arLayers ?? 0, 8) / 8) * 0.2
    );
  }

  // Only rate the bracelet of a watch that actually ships on one, and only once
  // the clasp hardware has been surveyed. Scoring a strap watch here would read
  // as "trails on bracelet" when the dimension does not apply; scoring a bare
  // `braceletIncluded: true` would put every unsurveyed bracelet at 0.40,
  // below every rubric reference, on no evidence at all.
  if (f.braceletIncluded === true && recordedCount(f, BRACELET_HARDWARE_FLAGS) > 0) {
    out.bracelet = clamp01(
      0.4 + (f.microAdjustClasp ? 0.35 : 0) + (f.quickRelease ? 0.25 : 0)
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

export const DIMENSION_LABELS: Record<Dimension, string> = {
  movement: "Movement",
  caseCraft: "Case craft",
  wearability: "Wearability",
  durability: "Durability",
  bracelet: "Bracelet",
};

/** What each dimension is judging, for a UI tooltip or caption. */
export const DIMENSION_BLURBS: Record<Dimension, string> = {
  movement: "Caliber tier, plus regulation and power reserve.",
  caseCraft: "Finishing and case hardware: coatings, bezel insert, drilled lugs, AR layers.",
  wearability: "Thickness relative to diameter — how the case sits on a wrist.",
  durability: "Water resistance against what the category needs, plus crystal and antimagnetism.",
  bracelet: "Bracelet hardware: micro-adjust clasp and quick-release.",
};

/**
 * Why a dimension came back unrated, phrased for display. Keeps the UI honest
 * about which input is missing instead of showing a bare dash.
 */
export function unratedReason(watch: Watch, dimension: Dimension): string {
  const s = watch.specs ?? {};
  const f = watch.qualityFlags ?? {};
  switch (dimension) {
    case "movement":
      return s.caliber ? `Caliber "${s.caliber}" not in the tier table` : "No caliber recorded";
    case "wearability":
      if (s.caseThicknessMm === undefined && s.caseDiameterMm === undefined)
        return "No case dimensions recorded";
      return s.caseThicknessMm === undefined ? "No case thickness recorded" : "No case diameter recorded";
    case "caseCraft":
      return recordedCount(f, CASE_CRAFT_FLAGS) === 0
        ? "No finishing details recorded"
        : "Only one finishing detail recorded";
    case "bracelet":
      if (f.braceletIncluded === false) return "Ships on a strap — no bracelet to rate";
      if (f.braceletIncluded === undefined) return "Not recorded whether it ships on a bracelet";
      return "No clasp hardware recorded";
    case "durability":
      return "No water resistance recorded";
  }
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
  const usd = priceUsd(watch);
  const band = usd !== undefined ? priceBandFor(usd) : undefined;

  const members = allWatches.filter((candidate) => {
    if (deriveCategory(candidate) !== category) return false;
    const candidateUsd = priceUsd(candidate);
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
  dimensions: Partial<
    Record<
      Dimension,
      {
        raw: number;
        rubricBand: string;
        /** Par for this dimension in the band. Absent when the watch is unpriced. */
        reference?: number;
      }
    >
  >;
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
}

function compositeQuality(raw: Partial<Record<Dimension, number>>): number | undefined {
  const rated = DIMENSIONS.flatMap((dimension) => {
    const value = raw[dimension];
    return value === undefined ? [] : [value];
  });
  if (rated.length === 0) return undefined;
  return rated.reduce((sum, value) => sum + value, 0) / rated.length;
}

/**
 * Full peer-band standing for one watch. Scores come from the fixed rubric for
 * the watch's category and price band; the peer group contributes only the
 * label, the count, and (when n >= 6) a percentile.
 */
export function computeStanding(
  watch: Watch,
  allWatches: Watch[],
  onWarning?: (message: string) => void
): Standing {
  const peerGroup = derivePeerGroup(watch, allWatches);
  const raw = scoreDimensions(watch);
  const usd = priceUsd(watch, onWarning);
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
  };
}
