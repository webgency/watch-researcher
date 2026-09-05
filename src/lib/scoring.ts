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

/** Bounds of the anchored 1-5 design-appeal rating. */
export const DESIGN_RANK_MIN = 1;
export const DESIGN_RANK_MAX = 5;
export const DESIGN_ELO_BASE = 1000;
export const DESIGN_ELO_K = 32;
/** Ratings 4-5 mean “I like the look”; the line sits between 3 and 4. */
export const DESIGN_LIKE_THRESHOLD = 60;

export type DesignComparisonOutcome = "left" | "right" | "tie";

export function updateDesignElo(
  leftElo = DESIGN_ELO_BASE,
  rightElo = DESIGN_ELO_BASE,
  outcome: DesignComparisonOutcome
): { left: number; right: number } {
  const expectedLeft = 1 / (1 + 10 ** ((rightElo - leftElo) / 400));
  const actualLeft = outcome === "left" ? 1 : outcome === "right" ? 0 : 0.5;
  const change = DESIGN_ELO_K * (actualLeft - expectedLeft);
  return {
    left: Math.round((leftElo + change) * 100) / 100,
    right: Math.round((rightElo - change) * 100) / 100,
  };
}

// Currency conversion rates used before scoring. The table lives in
// ./currency-rates.mjs because scripts/validate-data.mjs needs the same
// currency list and runs under bare Node with no build step. Re-exported here
// so existing importers keep working.
import { CURRENCY_TO_USD as RATES, RATES_AS_OF } from "./currency-rates.mjs";

// Widened to a string index so an unrecognized code reads as undefined and hits
// the warning path below, rather than being a type error at every call site.
export const CURRENCY_TO_USD: Record<string, number> = RATES;
export { RATES_AS_OF };

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
 * Your anchored 1-5 design appeal as a continuous 0-100 score, or null when
 * you have not rated it. Pairwise preferences refine position only inside the
 * selected 20-point band, so a refined 3 can never outrank a 4.
 *
 * This replaces a weighted desirability score whose three inputs did not hold
 * up. Brand reputation was a constant — every brand in data/brands.json sits at
 * reputationTier 3 — so its 35% contributed no variance. Wishlist tier is the
 * judgement the matrix exists to inform, so feeding it back in at 25% made the
 * chart partly restate its own input. Design was the only live term, and for
 * the watches without a design rating the score collapsed to exactly five
 * values, one per wishlist tier.
 *
 * Unranked returns null rather than a neutral 3: a neutral fill would park
 * every unranked watch on the median line and read as an opinion never given.
 */
export function computeDesignScore(watch: Watch): number | null {
  const rank = watch.designUniqueness;
  if (typeof rank !== "number" || !Number.isInteger(rank)) return null;
  if (rank < DESIGN_RANK_MIN || rank > DESIGN_RANK_MAX) return null;
  const bandStart = (rank - DESIGN_RANK_MIN) * 20;
  if (!watch.designComparisonCount || watch.designPreferenceElo === undefined) return bandStart + 10;
  // 80 Elo points spans the useful interior of a band. Clamp away from the
  // edges to preserve a visible gap between adjacent appeal ratings.
  const withinBand = clamp01(0.5 + (watch.designPreferenceElo - DESIGN_ELO_BASE) / 160);
  return bandStart + 1 + withinBand * 18;
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
  // Proprietary automatic monopusher chronograph with a patented retrograde
  // regatta module and 64h reserve; kept below the METAS anchor above.
  ["alb01 a", 0.80],
  ["sw510", 0.72],
  ["l688", 0.72],
  ["st-1901b", 0.70],
  ["soprod c125", 0.68],
  ["l888", 0.65],
  ["sw300", 0.65],
  // Sellita's GMT caliber, a 2893 derivative — the same architecture family as
  // the 2892-derived SW300, so it sits alongside it. COSC versions are not
  // rated higher here: certification is regulation, which scoreDimensions
  // already rewards separately through regulatedPositions.
  ["sw330", 0.65],
  ["ne88", 0.65],
  ["ne86", 0.62],
  ["la joux-perret", 0.65],
  ["miyota 9075", 0.62],
  ["powermatic 80", 0.60],
  ["rw3230", 0.60],
  ["peseux 7001", 0.60],
  // Catalogs often wrap Peseux in punctuation ("ETA (Peseux) 7001"), so the
  // caliber number is the stable alias rather than the exact display string.
  ["7001", 0.60],
  ["miyota 9100", 0.58],
  ["sw200-1", 0.58],
  ["sw200", 0.55],
  ["miyota 9015", 0.55],
  ["miyota 9039", 0.55],
  ["9039", 0.55],
  ["france ebauche", 0.45],
  // OT.G102 is a 4 Hz automatic base with the maker's jump-hour module. The
  // architecture is distinctive, but it is not presented as chronometer-grade.
  ["ot.g102", 0.45],
  ["st1721", 0.45],
  ["miyota 8215", 0.38],
  ["nh38", 0.35],
  ["nh34", 0.32],
  ["nh35", 0.30],
  ["meca-quartz", 0.30],
  ["fc-206", 0.25],
  ["ronda 1032", 0.20],
];

/** Base movement tier for a caliber string, or undefined when unrecognized. */
export function caliberTier(caliber: string | undefined): number | undefined {
  const key = caliber?.toLowerCase().trim();
  if (!key) return undefined;
  return CALIBER_TIER_PATTERNS.find(([pattern]) => key.includes(pattern))?.[1];
}

/**
 * Explicit category wins. Legacy tags are accepted only when they resolve to
 * one category; ordering must never decide which rubric a hybrid watch gets.
 */
export function deriveCategory(watch: Watch): RubricCategory | undefined {
  if (watch.scoringCategory) return watch.scoringCategory;

  const inferred = new Set<RubricCategory>();
  for (const tag of watch.tags ?? []) {
    const normalized = tag.trim().toLowerCase();
    if (normalized === "diver" || normalized === "dive") inferred.add("diver");
    if (normalized === "chronograph") inferred.add("chronograph");
    if (normalized === "gmt" || normalized === "worldtimer") inferred.add("gmt");
    if (normalized === "dress") inferred.add("dress");
  }
  return inferred.size === 1 ? [...inferred][0] : undefined;
}

/** All-in USD price used for banding: landedPrice when present, else price. */
export function landedPriceUsd(watch: Watch, onWarning?: (message: string) => void): number | undefined {
  const money = watch.landedPrice ?? watch.price;
  return money ? normalizePriceToUsd(money, onWarning) : undefined;
}

/** qualityFlags each dimension reads. A dimension is rated only if at least one is recorded. */
const CASE_CRAFT_FLAGS = ["hardenedCoatingHv", "sapphireBezelInsert", "drilledLugs", "arLayers"] as const;
const BRACELET_FLAGS = ["braceletIncluded", "microAdjustClasp", "quickRelease"] as const;

export interface DimensionEvidence {
  raw: number;
  /** Fraction of this dimension's source inputs that are recorded. */
  coverage: number;
  knownInputs: number;
  totalInputs: number;
}

function evidence(raw: number, knownInputs: number, totalInputs: number): DimensionEvidence {
  return { raw: clamp01(raw), coverage: knownInputs / totalInputs, knownInputs, totalInputs };
}

// Expected case thickness for a diameter: a fixed vertical stack plus a part
// that does scale with width (bezel, crystal dome, lug arch). The pair is
// pinned so that a 40mm case expects 12.4mm — exactly the old 0.31 ratio par —
// which keeps every rubric reference in rubrics.ts calibrated where it was.
// Only the slope away from 40mm changed. The empirical fit over the collection
// (5.53 + 0.173*d) agrees to within 0.06mm at 40mm; these are the rounded pair.
const WEARABILITY_FIXED_STACK_MM = 6.0;
const WEARABILITY_THICKNESS_PER_MM = 0.16;

// Millimetres of thickness between wearing excellently (1) and badly (0),
// held constant across diameters on purpose: 2mm of extra height reads as 2mm
// on the wrist whether the case is 37mm or 44mm wide. Under the old ratio this
// span silently widened with diameter (0.10 * d), which is the second half of
// why big watches got an easier grade than small ones.
const WEARABILITY_SPAN_MM = 4.0;
const EXPECTED_LUG_OVERHANG_MM = 8.0;
const LUG_TO_LUG_SPAN_MM = 8.0;
const THICKNESS_PROFILE_WEIGHT = 0.6;

export function caseProfileEvidence(
  specs: Watch["specs"],
  thicknessAllowanceMm = 0
): DimensionEvidence | undefined {
  if (specs.caseDiameterMm === undefined || specs.caseDiameterMm <= 0 || specs.caseThicknessMm === undefined) {
    return undefined;
  }
  const expectedThicknessMm =
    WEARABILITY_FIXED_STACK_MM + WEARABILITY_THICKNESS_PER_MM * specs.caseDiameterMm + thicknessAllowanceMm;
  const thicknessScore = clamp01(0.5 + (expectedThicknessMm - specs.caseThicknessMm) / WEARABILITY_SPAN_MM);
  const hasLugToLug = specs.lugToLugMm !== undefined;
  const lugToLugScore = hasLugToLug
    ? clamp01(0.5 + (specs.caseDiameterMm + EXPECTED_LUG_OVERHANG_MM - specs.lugToLugMm!) / LUG_TO_LUG_SPAN_MM)
    : undefined;
  const raw = lugToLugScore === undefined
    ? thicknessScore
    : thicknessScore * THICKNESS_PROFILE_WEIGHT + lugToLugScore * (1 - THICKNESS_PROFILE_WEIGHT);
  return evidence(raw, hasLugToLug ? 3 : 2, 3);
}

/**
 * Raw dimension scores against fixed anchors. Any dimension lacking source
 * data returns undefined, not a number:
 * - movement needs a recognized caliber
 * - wearability needs both diameter and thickness
 * - caseCraft and bracelet each need one of their own qualityFlags recorded
 * - durability needs at least one recorded durability input
 */
export function scoreDimensionEvidence(watch: Watch): Partial<Record<Dimension, DimensionEvidence>> {
  const s = watch.specs ?? {};
  const f = watch.qualityFlags ?? {};
  const category = deriveCategory(watch);
  const expectation = category ? CATEGORY_EXPECTATION[category] : undefined;

  const out: Partial<Record<Dimension, DimensionEvidence>> = {};

  const caliberBase = caliberTier(s.caliber);
  if (caliberBase !== undefined) {
    // Regulation is expensive and almost nobody at this price point does it.
    const regBonus = f.regulatedPositions ? Math.min(0.2, f.regulatedPositions * 0.05) : 0;
    const prBonus =
      s.powerReserveHours !== undefined ? clamp01((s.powerReserveHours - 38) / 42) * 0.1 : 0;
    const knownInputs = 1 + Number(f.regulatedPositions !== undefined) + Number(s.powerReserveHours !== undefined);
    out.movement = evidence(caliberBase + regBonus + prBonus, knownInputs, 3);
  }

  const profile = caseProfileEvidence(s);
  if (profile) {
    // Thickness measured against what this diameter should cost, not as a bare
    // thickness/diameter ratio. A ratio assumes height scales with width, and
    // it does not: a movement, crystal and caseback are a near-fixed stack
    // whatever the case is around them. Regressing thickness on diameter over
    // the collection gives t = 5.53 + 0.173*d — about 5.5mm that never shrinks.
    // So a ratio charges small cases for height they cannot avoid and hands
    // large ones credit for width they did nothing to earn: a 37x11.6 (a well
    // proportioned watch) scored below a 44x13 (a slab).
    // Thickness remains the primary profile signal, while a compact or broad
    // footprint can move the result meaningfully without claiming to know how
    // the watch fits a particular wrist.
    out.wearability = profile;
  }

  // Each of these needs its own source data. Gating both on "any qualityFlags
  // at all" scored a watch that had only, say, an accuracy spec recorded as
  // though its case had no hardening, no sapphire bezel and no drilled lugs.
  // For caseCraft that fabricated score was the 0.35 base, which sits below
  // every band's rubric reference, so the watch was guaranteed to trail on a
  // dimension nobody had measured.
  if (CASE_CRAFT_FLAGS.some((flag) => f[flag] !== undefined)) {
    let achieved = 0;
    if (f.hardenedCoatingHv !== undefined) {
      if (f.hardenedCoatingHv > 0) achieved += 0.2;
    }
    if (f.sapphireBezelInsert !== undefined) {
      if (f.sapphireBezelInsert) achieved += 0.15;
    }
    if (f.drilledLugs !== undefined) {
      if (f.drilledLugs) achieved += 0.1;
    }
    if (f.arLayers !== undefined) {
      achieved += (Math.min(f.arLayers, 8) / 8) * 0.2;
    }
    const knownInputs = CASE_CRAFT_FLAGS.filter((flag) => f[flag] !== undefined).length;
    // Keep the established rubric scale: the score states verified capability,
    // while coverage states how much of the possible evidence was inspected.
    // Unknown features add neither verified points nor negative evidence.
    out.caseCraft = evidence(0.35 + achieved, knownInputs, CASE_CRAFT_FLAGS.length);
  }

  // A watch sold on a strap has no bracelet to judge, so the dimension is not
  // applicable rather than bad. Scoring it 0 against a 0.40-0.85 rubric
  // expectation conflated "no bracelet offered" with "poor bracelet", and
  // double-counted a concern the model deliberately keeps out of the numbers:
  // friction.braceletUpchargeUsd already surfaces the cost of adding one, as
  // text. Not applicable is distinct from not recorded, but both mean the
  // dimension should stay out of the composite.
  if (f.braceletIncluded !== false && BRACELET_FLAGS.some((flag) => f[flag] !== undefined)) {
    const parts: Array<[boolean | undefined, number]> = [
      [f.braceletIncluded, 0.4],
      [f.microAdjustClasp, 0.35],
      [f.quickRelease, 0.25],
    ];
    const known = parts.filter(([value]) => value !== undefined);
    const achieved = known.reduce((sum, [value, weight]) => sum + (value ? weight : 0), 0);
    out.bracelet = evidence(achieved, known.length, parts.length);
  }

  if ((s.waterResistanceM !== undefined && expectation) || s.crystal !== undefined || f.antimagneticAm !== undefined) {
    const parts: Array<{ known: boolean; weight: number; score: number }> = [
      {
        known: s.waterResistanceM !== undefined && expectation !== undefined,
        weight: 0.5,
        score: s.waterResistanceM !== undefined && expectation
          ? clamp01(s.waterResistanceM / expectation.wrM)
          : 0,
      },
      {
        known: s.crystal !== undefined,
        weight: 0.25,
        score: (s.crystal ?? "").toLowerCase().includes("sapphire") ? 1 : 0,
      },
      {
        known: f.antimagneticAm !== undefined,
        weight: 0.25,
        score: clamp01((f.antimagneticAm ?? 0) / 25000),
      },
    ];
    const known = parts.filter((part) => part.known);
    const achieved = known.reduce((sum, part) => sum + part.score * part.weight, 0);
    out.durability = evidence(achieved, known.length, parts.length);
  }

  return out;
}

/** Backwards-compatible raw score view for callers that do not need coverage. */
export function scoreDimensions(watch: Watch): Partial<Record<Dimension, number>> {
  return Object.fromEntries(
    Object.entries(scoreDimensionEvidence(watch)).map(([dimension, result]) => [dimension, result.raw])
  );
}

export interface PeerGroup {
  category?: RubricCategory;
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
    label: `${category ? CATEGORY_PLURAL[category] : "category unrated"}, ${band ? band.label : "unpriced"}`,
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
// before a watch is described as above or below expectations for its price.
export const RUBRIC_TOLERANCE = 0.05;

// A single recorded flag can produce a tentative dimension score, but it is
// not enough evidence to make a price-relative verdict or influence value.
// This prevents one narrow fact (for example, a ceramic rather than sapphire
// bezel insert) from masquerading as a judgment of the whole case.
export const MIN_REFERENCE_COVERAGE: Record<Dimension, number> = {
  movement: 1 / 3,
  caseCraft: 0.5,
  wearability: 2 / 3,
  durability: 1 / 3,
  bracelet: 0.5,
};

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
  dimensions: Partial<Record<Dimension, { raw: number; coverage: number; knownInputs: number; totalInputs: number; rubricBand: string; reference?: number }>>;
  /** Dimensions with missing source data — display "unrated", never 0. */
  unrated: Dimension[];
  /** Composite of rated dimensions only. Undefined when nothing is rated. */
  qualityScore?: number;
  /** Quality relative to landed price within the band. Needs a price and a rated dimension. */
  valueScore?: number;
  /** How much applicable source evidence is recorded, from 0-1. */
  evidenceCoverage: number;
  confidence: "low" | "medium" | "high";
  /** Rank of qualityScore within the peer group; only when the group has n >= 6. */
  qualityPercentile?: number;
  /** Dimensions above the band's rubric reference. */
  beats: Dimension[];
  /** Dimensions below the band's rubric reference. */
  trails: Dimension[];
  /** Human-readable friction chips. Never numeric, never part of any score. */
  frictions: string[];
}

function compositeQuality(raw: Partial<Record<Dimension, DimensionEvidence>>): number | undefined {
  const rated = DIMENSIONS.flatMap((dimension) => {
    const value = raw[dimension];
    return value === undefined ? [] : [value];
  });
  if (rated.length === 0) return undefined;
  const totalWeight = rated.reduce((sum, value) => sum + value.coverage, 0);
  return rated.reduce((sum, value) => sum + value.raw * value.coverage, 0) / totalWeight;
}

export function confidenceFor(coverage: number): Standing["confidence"] {
  if (coverage >= 0.8) return "high";
  if (coverage >= 0.5) return "medium";
  return "low";
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
  const raw = scoreDimensionEvidence(watch);
  const usd = landedPriceUsd(watch);
  const band = peerGroup.band;
  const rubric: RubricReference | undefined = band
    && peerGroup.category ? rubricFor(peerGroup.category, band.id)
    : undefined;

  const dimensions: Standing["dimensions"] = {};
  const beats: Dimension[] = [];
  const trails: Dimension[] = [];
  for (const dimension of DIMENSIONS) {
    const value = raw[dimension];
    if (value === undefined) continue;
    dimensions[dimension] = {
      raw: value.raw,
      coverage: value.coverage,
      knownInputs: value.knownInputs,
      totalInputs: value.totalInputs,
      rubricBand: band?.id ?? "unbanded",
      reference: rubric?.[dimension],
    };
    if (rubric && value.coverage >= MIN_REFERENCE_COVERAGE[dimension]) {
      if (value.raw > rubric[dimension] + RUBRIC_TOLERANCE) beats.push(dimension);
      else if (value.raw < rubric[dimension] - RUBRIC_TOLERANCE) trails.push(dimension);
    }
  }

  const qualityScore = compositeQuality(raw);

  // Par quality at the band's midpoint price scores 0.5: beating the rubric on
  // the rated dimensions raises it, sitting cheap within the band raises it.
  // Price-relative value uses only dimensions with enough evidence to support
  // a comparison. Tentative scores can still inform Quality at reduced weight,
  // but cannot manufacture an above/below expectation verdict.
  let valueScore: number | undefined;
  if (qualityScore !== undefined && rubric && band && usd !== undefined) {
    const ratedDimensions = DIMENSIONS.filter(
      (dimension) => raw[dimension] !== undefined && raw[dimension]!.coverage >= MIN_REFERENCE_COVERAGE[dimension]
    );
    if (ratedDimensions.length === 0) {
      valueScore = undefined;
    } else {
      const evidenceWeight = ratedDimensions.reduce((sum, dimension) => sum + raw[dimension]!.coverage, 0);
      const comparableQuality =
        ratedDimensions.reduce((sum, dimension) => sum + raw[dimension]!.raw * raw[dimension]!.coverage, 0) /
        evidenceWeight;
      const referenceQuality =
        ratedDimensions.reduce((sum, dimension) => sum + rubric[dimension] * raw[dimension]!.coverage, 0) /
        evidenceWeight;
      const pricePosition = clamp01((usd - band.minUsd) / (band.maxUsd - band.minUsd));
      valueScore = clamp01(
        0.5 + (comparableQuality - referenceQuality) - VALUE_PRICE_TILT * (pricePosition - 0.5)
      );
    }
  }

  // Optional peer-relative rank, only meaningful once the group is big enough.
  let qualityPercentile: number | undefined;
  if (qualityScore !== undefined) {
    const pool = peerGroup.members.flatMap((member) => {
      const memberQuality = compositeQuality(scoreDimensionEvidence(member));
      return memberQuality === undefined ? [] : [memberQuality];
    });
    qualityPercentile = percentile(qualityScore, pool);
  }

  const applicableDimensions = DIMENSIONS.filter(
    (dimension) => dimension !== "bracelet" || watch.qualityFlags?.braceletIncluded !== false
  );
  const evidenceCoverage = applicableDimensions.reduce(
    (sum, dimension) => sum + (raw[dimension]?.coverage ?? 0),
    0
  ) / applicableDimensions.length;

  return {
    peerLabel: peerGroup.label,
    peerCount: peerGroup.members.length,
    dimensions,
    unrated: DIMENSIONS.filter((dimension) => raw[dimension] === undefined),
    qualityScore,
    valueScore,
    evidenceCoverage,
    confidence: confidenceFor(evidenceCoverage),
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
  /** Your design appeal as 0-100, or null when the watch is unrated. */
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
