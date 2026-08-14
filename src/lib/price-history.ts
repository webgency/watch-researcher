import { Money, PriceSnapshot, Watch } from "./types";
import { landedPriceUsd, normalizePriceToUsd } from "./scoring";

// ---------------------------------------------------------------------------
// Price history and target-price tracking.
//
// The series records only moves: re-observing the same price extends nothing,
// so every consecutive pair of snapshots differs and each date answers "it has
// been this much since when?". That keeps data/watches.json from growing by a
// line per watch per scrape run, and keeps the history readable as a list of
// events rather than a log of polls.
// ---------------------------------------------------------------------------

export function sameMoney(a: Money | undefined, b: Money | undefined): boolean {
  if (!a || !b) return false;
  return a.amount === b.amount && a.currency.trim().toUpperCase() === b.currency.trim().toUpperCase();
}

/** Newest snapshot, or undefined for an empty/absent series. */
export function latestSnapshot(history: PriceSnapshot[] | undefined): PriceSnapshot | undefined {
  return history?.length ? history[history.length - 1] : undefined;
}

/**
 * The series with `price` appended, or unchanged when the price has not moved.
 *
 * Returns the original array reference when nothing was added, so callers can
 * use identity to decide whether a write is needed.
 */
export function appendSnapshot(
  history: PriceSnapshot[] | undefined,
  price: Money,
  date: string,
  source?: string
): PriceSnapshot[] {
  const existing = history ?? [];
  if (sameMoney(latestSnapshot(existing)?.price, price)) return existing;
  const snapshot: PriceSnapshot = { price, date };
  if (source) snapshot.source = source;
  return [...existing, snapshot];
}

export interface PriceMovement {
  previous: PriceSnapshot;
  latest: PriceSnapshot;
  /** Signed change in USD; negative means the price dropped. */
  deltaUsd: number;
  /** Signed change as a fraction of the previous price, e.g. -0.1 = down 10%. */
  deltaPct: number;
}

/** The most recent move, or undefined when there are fewer than two snapshots. */
export function priceMovement(history: PriceSnapshot[] | undefined): PriceMovement | undefined {
  if (!history || history.length < 2) return undefined;
  const previous = history[history.length - 2];
  const latest = history[history.length - 1];
  const previousUsd = normalizePriceToUsd(previous.price);
  const latestUsd = normalizePriceToUsd(latest.price);
  if (previousUsd === 0) return undefined;
  return {
    previous,
    latest,
    deltaUsd: latestUsd - previousUsd,
    deltaPct: (latestUsd - previousUsd) / previousUsd,
  };
}

/** Lowest price ever recorded, by USD-normalized amount. */
export function lowestSnapshot(history: PriceSnapshot[] | undefined): PriceSnapshot | undefined {
  if (!history?.length) return undefined;
  return history.reduce((lowest, snapshot) =>
    normalizePriceToUsd(snapshot.price) < normalizePriceToUsd(lowest.price) ? snapshot : lowest
  );
}

export interface TargetStatus {
  target: Money;
  targetUsd: number;
  /** All-in price being compared: landedPrice when set, else price. */
  currentUsd: number;
  met: boolean;
  /** How far above target, in USD. 0 once met. */
  gapUsd: number;
  /** Fraction above target, e.g. 0.12 = 12% over. 0 once met. */
  gapPct: number;
}

/**
 * Where the watch sits against its target price, or undefined when no target is
 * set or there is no price to compare.
 *
 * Compares against the all-in landed price for the same reason the scoring
 * engine bands on it: a target met only by ignoring shipping and duty has not
 * really been met.
 */
export function targetStatus(watch: Watch): TargetStatus | undefined {
  if (!watch.targetPrice) return undefined;
  const currentUsd = landedPriceUsd(watch);
  if (currentUsd === undefined) return undefined;

  const targetUsd = normalizePriceToUsd(watch.targetPrice);
  const met = currentUsd <= targetUsd;
  const overage = met ? 0 : currentUsd - targetUsd;
  return {
    target: watch.targetPrice,
    targetUsd,
    currentUsd,
    met,
    gapUsd: overage,
    gapPct: targetUsd === 0 ? 0 : overage / targetUsd,
  };
}

/** Watches now at or below their target, for surfacing in the collection view. */
export function watchesAtTarget(watches: Watch[]): Watch[] {
  return watches.filter((watch) => targetStatus(watch)?.met);
}
