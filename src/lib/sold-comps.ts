import { normalizePriceToUsd } from "./scoring";
import type { Condition, SoldComp, Watch } from "./types";
import { freshnessForAge, observationAgeDays, type FreshnessTier } from "./valuation";

export interface DatedSoldComp extends SoldComp {
  priceUsd: number;
  ageDays?: number;
  freshness?: FreshnessTier;
}

export interface SoldCompSummary {
  comps: DatedSoldComp[];
  /** Median of the recorded sales, only once two exist. */
  medianUsd?: number;
  lowUsd?: number;
  highUsd?: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Recorded sales, newest first, with each one's age.
 *
 * Deliberately not wired into dealScore or marketValueSummary: the deal
 * comparison is ask-vs-ask, and mixing a handful of hand-entered sales into it
 * would change what the percentage means without changing how it reads. Solds
 * are shown beside the asks so the reader can weigh them.
 */
export function soldComps(watch: Pick<Watch, "soldComps">, now: Date = new Date()): DatedSoldComp[] {
  return [...(watch.soldComps ?? [])]
    .map((comp) => {
      const ageDays = observationAgeDays(comp.soldAt, now);
      return {
        ...comp,
        priceUsd: normalizePriceToUsd(comp.price),
        ageDays,
        freshness: ageDays === undefined ? undefined : freshnessForAge(ageDays),
      };
    })
    .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
}

/**
 * Sold summary for one condition, or all of them when `condition` is omitted.
 * A median needs two sales for the same reason an asking estimate does: one
 * number is an anecdote, and printing it as a midpoint implies a spread that
 * was never observed.
 */
export function soldCompSummary(
  watch: Pick<Watch, "soldComps">,
  condition?: Condition,
  now: Date = new Date()
): SoldCompSummary {
  const comps = soldComps(watch, now).filter((comp) => !condition || comp.condition === condition);
  if (comps.length < 2) return { comps };
  const prices = comps.map((comp) => comp.priceUsd);
  return {
    comps,
    medianUsd: median(prices),
    lowUsd: Math.min(...prices),
    highUsd: Math.max(...prices),
  };
}
