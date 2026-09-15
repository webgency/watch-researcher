import type { Money, RetailerLink, Watch } from "./types";
import { bestOffer, marketValueSummary, type BestOffer, type MarketValueSummary } from "./valuation";
import { normalizeMoneyToUsd } from "./offer-signals.mjs";

export type TradeUpBasis = "ask" | "target";

export interface TradeUpCandidate {
  id: string;
  label: string;
  best: BestOffer;
  target?: { price: Money; priceUsd: number };
  /** The candidate's own records, for editing them in place. `targetPrice` is
   * the stored value even when unconvertible, so an edit's revision matches. */
  links: RetailerLink[];
  targetPrice?: Money;
}

export interface TradeUpModel {
  watchId: string;
  watchLabel: string;
  links: RetailerLink[];
  exit: MarketValueSummary;
  candidates: TradeUpCandidate[];
  asOf: string;
}

function usableMoney(price?: Money): boolean {
  const usd = normalizeMoneyToUsd(price);
  return usd !== undefined && usd > 0;
}

/**
 * Prepare only the evidence the interactive panel needs. An owned watch's
 * new retail price is not an exit estimate: never use dealScore's alternate
 * condition fallback here. The same two-source gate as Market still applies.
 */
export function tradeUpModel(watch: Watch, watches: Watch[], now: Date = new Date()): TradeUpModel | undefined {
  if (watch.status !== "owned") return undefined;
  // The general valuation helper assumes schema-validated currencies. Keep an
  // unconvertible import from ever masquerading as USD in this money bridge.
  const validLinks = watch.links.filter((link) => usableMoney(link.price));
  return {
    watchId: watch.id,
    watchLabel: `${watch.brand} ${watch.model}`,
    links: watch.links,
    exit: marketValueSummary({ ...watch, links: validLinks }, "pre-owned", now),
    asOf: now.toISOString(),
    candidates: watches
      .filter((candidate) => candidate.status === "wishlist" && candidate.id !== watch.id)
      .map((candidate) => ({
        id: candidate.id,
        label: `${candidate.brand} ${candidate.model}`,
        best: bestOffer({ ...candidate, links: candidate.links.filter((link) => usableMoney(link.price)) }, undefined, now),
        target: usableMoney(candidate.targetPrice)
          ? { price: candidate.targetPrice!, priceUsd: normalizeMoneyToUsd(candidate.targetPrice)! }
          : undefined,
        links: candidate.links,
        targetPrice: candidate.targetPrice,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function candidateCost(candidate: TradeUpCandidate, basis: TradeUpBasis): number | undefined {
  return basis === "target"
    ? candidate.target?.priceUsd
    : candidate.best.status === "available" ? candidate.best.offer.priceUsd : undefined;
}

export type TradeUpBridge =
  | { status: "insufficient"; reason: "exit" | "candidate" }
  | { status: "available"; medianUsd: number; lowUsd: number; highUsd: number };

/** Signed differences: negative means the candidate costs less. Never clamp
 * to zero or call the difference profit. A higher exit means a smaller gap,
 * so the exit range's endpoints must be reversed when calculating the bridge. */
export function tradeUpBridge(exit: MarketValueSummary, costUsd?: number): TradeUpBridge {
  if (exit.confidence === "insufficient" || exit.medianUsd === undefined || exit.lowUsd === undefined || exit.highUsd === undefined) {
    return { status: "insufficient", reason: "exit" };
  }
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) {
    return { status: "insufficient", reason: "candidate" };
  }
  return {
    status: "available",
    medianUsd: costUsd - exit.medianUsd,
    lowUsd: costUsd - exit.highUsd,
    highUsd: costUsd - exit.lowUsd,
  };
}
