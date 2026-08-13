import { BrandCatalog, Money, MovementType, QualityFlags, Watch, WishlistTier } from "./types";
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
  desirability: number;
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
  desirabilityScore: number;
  quadrant: Quadrant | null;
  dataCompleteness: DataCompleteness;
}

export interface WatchScoreSummary {
  valueScore: number | null;
  desirabilityScore: number;
  quadrant: Quadrant | null;
  dataCompleteness: DataCompleteness;
  valueRank: number | null;
}

// Tuning knob: neutral fill used for missing optional spec inputs.
export const NEUTRAL_QUALITY = 0.5;

// Tuning knob: neutral 1-5 ordinal used for missing subjective inputs.
export const NEUTRAL_ORDINAL = 3;

// Tuning knob: price floor before log compression.
export const MIN_PRICE_USD = 10;

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

// Tuning knob: movement quality contribution to objective spec quality.
export const MOVEMENT_QUALITY: Record<MovementType, number> = {
  "spring-drive": 1.0,
  automatic: 0.85,
  manual: 0.8,
  kinetic: 0.5,
  solar: 0.45,
  other: 0.4,
  quartz: 0.35,
};

// Tuning knob: objective value weights. Material stays low until data is backfilled.
export const VALUE_WEIGHTS = {
  movement: 0.4,
  crystal: 0.2,
  waterResistance: 0.2,
  powerReserve: 0.15,
  material: 0.05,
} as const;

// Tuning knob: subjective desirability weights.
export const DESIRABILITY_WEIGHTS = {
  designUniqueness: 0.4,
  brandReputation: 0.35,
  wishlistTier: 0.25,
} as const;

// Tuning knob: wishlist tiers mapped onto a 1-5 desirability ordinal.
export const WISHLIST_TIER_ORDINAL: Record<WishlistTier, number> = {
  "next-purchase": 5,
  "must-have": 5,
  "love-it": 4,
  interested: 3,
  "maybe-later": 2,
  pass: 1,
};

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

export function crystalQuality(value?: string | null): number {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("sapphire")) return 1.0;
  if (normalized.includes("mineral")) return 0.5;
  if (normalized.includes("acrylic")) return 0.35;
  return 0.4;
}

export function materialQuality(value?: string | null): number {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return 0.5;
  if (normalized.includes("titanium") || normalized.includes("ceramic") || normalized.includes("gold")) return 1.0;
  if (normalized.includes("bronze")) return 0.8;
  if (normalized.includes("316l") || normalized.includes("steel")) return 0.7;
  return 0.5;
}

export function computeSpecQuality(watch: Watch, peers: Watch[]): number {
  const movement = watch.specs.movement ? MOVEMENT_QUALITY[watch.specs.movement] ?? 0.4 : 0.4;
  const crystal = crystalQuality(watch.specs.crystal);
  const material = materialQuality(watch.specs.caseMaterial);
  const waterResistance = normalizePeerNumber(
    watch.specs.waterResistanceM,
    peers.map((peer) => peer.specs.waterResistanceM)
  );
  const powerReserve = normalizePeerNumber(
    watch.specs.powerReserveHours,
    peers.map((peer) => peer.specs.powerReserveHours)
  );

  return (
    movement * VALUE_WEIGHTS.movement +
    crystal * VALUE_WEIGHTS.crystal +
    waterResistance * VALUE_WEIGHTS.waterResistance +
    powerReserve * VALUE_WEIGHTS.powerReserve +
    material * VALUE_WEIGHTS.material
  );
}

export function computeValueScore(watches: Watch[], onWarning?: (message: string) => void): Map<string, number | null> {
  const rawScores = watches.flatMap((watch) => {
    if (!watch.price) return [];
    const priceUsd = normalizePriceToUsd(watch.price, onWarning);
    const specQuality = computeSpecQuality(watch, watches);
    const raw = specQuality / Math.log10(Math.max(priceUsd, MIN_PRICE_USD));
    return [{ id: watch.id, raw }];
  });

  const byId = new Map<string, number | null>(watches.map((watch) => [watch.id, null]));
  if (rawScores.length === 0) return byId;

  const min = Math.min(...rawScores.map((score) => score.raw));
  const max = Math.max(...rawScores.map((score) => score.raw));

  for (const score of rawScores) {
    byId.set(score.id, min === max ? FIXED_THRESHOLD : ((score.raw - min) / (max - min)) * 100);
  }

  return byId;
}

export function computeDesirabilityScore(watch: Watch, brandReputation?: number | null): number {
  const designUniqueness = ordinalOrNeutral(watch.designUniqueness);
  const brand = ordinalOrNeutral(brandReputation);
  const wishlistTier = watch.wishlistTier ? WISHLIST_TIER_ORDINAL[watch.wishlistTier] : NEUTRAL_ORDINAL;
  const composite =
    designUniqueness * DESIRABILITY_WEIGHTS.designUniqueness +
    brand * DESIRABILITY_WEIGHTS.brandReputation +
    wishlistTier * DESIRABILITY_WEIGHTS.wishlistTier;

  return ((composite - 1) / 4) * 100;
}

export function computeDataCompleteness(watch: Watch): DataCompleteness {
  const fields = [
    { label: "movement", present: Boolean(watch.specs.movement) },
    { label: "crystal", present: Boolean(watch.specs.crystal) },
    { label: "water resistance", present: watch.specs.waterResistanceM !== undefined },
    { label: "power reserve", present: watch.specs.powerReserveHours !== undefined },
    { label: "case material", present: Boolean(watch.specs.caseMaterial) },
  ];
  const missing = fields.filter((field) => !field.present).map((field) => field.label);
  return {
    present: fields.length - missing.length,
    total: fields.length,
    missing,
  };
}

export function computeThresholds(
  scores: Array<{ valueScore: number | null; desirabilityScore: number }>,
  override?: Partial<ScoreThresholds>
): ThresholdResult {
  const rated = scores.filter((score): score is { valueScore: number; desirabilityScore: number } => score.valueScore !== null);
  const method = rated.length < MIN_MEDIAN_THRESHOLD_COUNT ? "fixed" : "median";
  const thresholds =
    method === "fixed"
      ? { value: FIXED_THRESHOLD, desirability: FIXED_THRESHOLD }
      : {
          value: median(rated.map((score) => score.valueScore)),
          desirability: median(rated.map((score) => score.desirabilityScore)),
        };

  return {
    thresholds: { ...thresholds, ...override },
    method,
  };
}

export function assignQuadrant(
  valueScore: number | null,
  desirabilityScore: number,
  thresholds: ScoreThresholds = { value: FIXED_THRESHOLD, desirability: FIXED_THRESHOLD }
): Quadrant | null {
  if (valueScore === null) return null;
  const highValue = valueScore >= thresholds.value;
  const highDesire = desirabilityScore >= thresholds.desirability;
  if (highValue && highDesire) return "buy";
  if (!highValue && highDesire) return "aspirational";
  if (highValue && !highDesire) return "sensible";
  return "skip";
}

export function computeWatchScores(
  watches: Watch[],
  brands: BrandCatalog,
  onWarning?: (message: string) => void
): { scores: WatchScore[]; thresholds: ScoreThresholds; thresholdMethod: ThresholdResult["method"] } {
  const valueScores = computeValueScore(watches, onWarning);
  const initialScores = watches.map((watch) => ({
    watch,
    valueScore: valueScores.get(watch.id) ?? null,
    desirabilityScore: computeDesirabilityScore(watch, resolveBrandReputation(watch.brand, brands)),
    dataCompleteness: computeDataCompleteness(watch),
  }));
  const { thresholds, method } = computeThresholds(initialScores);

  return {
    thresholds,
    thresholdMethod: method,
    scores: initialScores.map((score) => ({
      ...score,
      quadrant: assignQuadrant(score.valueScore, score.desirabilityScore, thresholds),
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
        desirabilityScore: score.desirabilityScore,
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
    b.desirabilityScore - a.desirabilityScore ||
    `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`)
  );
}

function normalizePeerNumber(value: number | undefined, peerValues: Array<number | undefined>): number {
  if (value === undefined) return NEUTRAL_QUALITY;
  const values = peerValues.filter((peerValue): peerValue is number => Number.isFinite(peerValue));
  if (values.length < 2) return NEUTRAL_QUALITY;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return NEUTRAL_QUALITY;
  return (value - min) / (max - min);
}

function ordinalOrNeutral(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : NEUTRAL_ORDINAL;
}

function median(values: number[]): number {
  if (values.length === 0) return FIXED_THRESHOLD;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function resolveBrandReputation(brand: string, brands: BrandCatalog): number | undefined {
  const normalized = brand.trim().toLowerCase();
  const match = Object.entries(brands).find(([name]) => name.trim().toLowerCase() === normalized);
  return match?.[1].reputationTier;
}

// ---------------------------------------------------------------------------
// Peer-band standing engine (Phase 1).
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
