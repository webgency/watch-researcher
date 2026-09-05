import { DIMENSIONS, Dimension, PRICE_BANDS, RUBRICS, RubricCategory } from "./rubrics";
import { caseProfileEvidence, deriveCategory, landedPriceUsd, MIN_REFERENCE_COVERAGE, scoreDimensionEvidence } from "./scoring";
import { Watch } from "./types";

const PRICE_ANCHORS_USD = PRICE_BANDS.map((range) => (range.minUsd + range.maxUsd) / 2);

/** Experimental allowance for the extra case stack associated with each category. */
export const CATEGORY_THICKNESS_ALLOWANCE_MM: Record<RubricCategory, number> = {
  diver: 1,
  chronograph: 0.5,
  gmt: 0.3,
  dress: 0,
  // No dive-case stack and no chronograph pushers, but not held to a dress
  // watch's thinness either — between gmt and dress.
  sports: 0.15,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolate(left: number, right: number, fraction: number): number {
  return left + (right - left) * fraction;
}

/**
 * Experimental price expectation interpolated between rubric range midpoints.
 * Log-price interpolation reflects proportional buying-power changes and avoids
 * a discontinuity when a watch moves from, for example, $499 to $501.
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
  return interpolate(
    RUBRICS[category][PRICE_BANDS[leftIndex].id][dimension],
    RUBRICS[category][PRICE_BANDS[rightIndex].id][dimension],
    fraction
  );
}

export interface CalibrationResult {
  qualityScore?: number;
  valueScore?: number;
  wearabilityScore?: number;
  referenceQuality?: number;
}

/** Proposed scoring for comparison reports only; production uses computeStanding(). */
export function calibrationScore(watch: Watch): CalibrationResult {
  const category = deriveCategory(watch);
  const priceUsd = landedPriceUsd(watch);
  const evidence = scoreDimensionEvidence(watch);

  if (category && evidence.wearability && watch.specs.caseDiameterMm && watch.specs.caseThicknessMm !== undefined) {
    evidence.wearability = caseProfileEvidence(watch.specs, CATEGORY_THICKNESS_ALLOWANCE_MM[category]);
  }

  const rated = DIMENSIONS.filter((dimension) => evidence[dimension] !== undefined);
  if (!rated.length) return {};
  const totalWeight = rated.reduce((sum, dimension) => sum + evidence[dimension]!.coverage, 0);
  const qualityScore = rated.reduce(
    (sum, dimension) => sum + evidence[dimension]!.raw * evidence[dimension]!.coverage,
    0
  ) / totalWeight;

  if (!category || priceUsd === undefined) {
    return { qualityScore, wearabilityScore: evidence.wearability?.raw };
  }

  const comparable = rated.filter((dimension) => evidence[dimension]!.coverage >= MIN_REFERENCE_COVERAGE[dimension]);
  if (!comparable.length) return { qualityScore, wearabilityScore: evidence.wearability?.raw };
  const comparisonWeight = comparable.reduce((sum, dimension) => sum + evidence[dimension]!.coverage, 0);
  const comparableQuality = comparable.reduce(
    (sum, dimension) => sum + evidence[dimension]!.raw * evidence[dimension]!.coverage,
    0
  ) / comparisonWeight;
  const referenceQuality = comparable.reduce(
    (sum, dimension) => sum + continuousReference(category, dimension, priceUsd) * evidence[dimension]!.coverage,
    0
  ) / comparisonWeight;

  return {
    qualityScore,
    valueScore: clamp01(0.5 + comparableQuality - referenceQuality),
    wearabilityScore: evidence.wearability?.raw,
    referenceQuality,
  };
}
