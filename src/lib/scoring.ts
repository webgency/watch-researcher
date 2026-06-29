import { BrandCatalog, Money, MovementType, Watch, WishlistTier } from "./types";

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
