import { continuousReference, DIMENSIONS, RubricCategory } from "./rubrics";
import { caseProfileEvidence, deriveCategory, landedPriceUsd, MIN_REFERENCE_COVERAGE, scoreDimensionEvidence } from "./scoring";
import { Watch } from "./types";

export { continuousReference } from "./rubrics";

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

export interface CalibrationResult {
  qualityScore?: number;
  valueScore?: number;
  wearabilityScore?: number;
  referenceQuality?: number;
}

/**
 * Comparison report for the remaining category-thickness experiment. Production
 * now uses the same continuous references, but deliberately keeps the established
 * wearability formula until the allowance has stronger calibration coverage.
 */
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
