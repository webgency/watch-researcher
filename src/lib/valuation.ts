import { normalizePriceToUsd } from "./scoring";
import { Condition, RetailerLink, Watch } from "./types";

export type MarketConfidence = "insufficient" | "low" | "medium" | "high";

export interface MarketObservation {
  source: string;
  priceUsd: number;
  observedAt: string;
  ageDays: number;
}

export interface MarketValueSummary {
  condition: Condition;
  observations: MarketObservation[];
  confidence: MarketConfidence;
  medianUsd?: number;
  lowUsd?: number;
  highUsd?: number;
}

function sourceKey(link: RetailerLink): string {
  try {
    return new URL(link.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return (link.retailer || link.url).trim().toLowerCase();
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Builds an asking-price estimate from dated, condition-matched, independent
 * retailer links. The headline tracked price is intentionally excluded: it is
 * often copied from one of these links and counting it again would manufacture
 * a second source. Two independent observations are the minimum for an
 * estimate; fewer observations report insufficient evidence instead of a
 * precise-looking guess.
 */
export function marketValueSummary(
  watch: Watch,
  condition: Condition,
  now: Date = new Date()
): MarketValueSummary {
  const bySource = new Map<string, MarketObservation>();

  for (const link of watch.links) {
    if (link.condition !== condition || !link.price || !link.observedAt) continue;
    const observed = new Date(link.observedAt);
    if (Number.isNaN(observed.getTime())) continue;
    const key = sourceKey(link);
    const observation: MarketObservation = {
      source: link.retailer?.trim() || key,
      priceUsd: normalizePriceToUsd(link.price),
      observedAt: link.observedAt,
      ageDays: Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000)),
    };
    const existing = bySource.get(key);
    if (!existing || new Date(existing.observedAt) < observed) bySource.set(key, observation);
  }

  const observations = [...bySource.values()].sort((a, b) => a.priceUsd - b.priceUsd);
  if (observations.length < 2) return { condition, observations, confidence: "insufficient" };

  const prices = observations.map((observation) => observation.priceUsd);
  const recent90 = observations.filter((observation) => observation.ageDays <= 90).length;
  const allRecent30 = observations.every((observation) => observation.ageDays <= 30);
  const confidence: MarketConfidence =
    observations.length >= 5 && allRecent30
      ? "high"
      : observations.length >= 3 && recent90 / observations.length >= 2 / 3
        ? "medium"
        : "low";

  return {
    condition,
    observations,
    confidence,
    medianUsd: median(prices),
    lowUsd: Math.min(...prices),
    highUsd: Math.max(...prices),
  };
}
