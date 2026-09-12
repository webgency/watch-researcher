import type { Watch } from "./types";
import { landedPriceUsd } from "./scoring";
import { watchesAtTarget } from "./price-history";
import { bestOffer } from "./valuation";

export interface CollectionSummary {
  /** Every watch on file, owned included. */
  tracked: number;
  /** Watches whose best dated offer is still inside the fresh window. */
  freshOffers: number;
  /** Landed USD for everything not marked owned — what the wishlist would cost. */
  wishlistValueUsd: number;
  /** Watches now at or below their target price. */
  atTarget: number;
}

/**
 * Collection-wide figures for the page header.
 *
 * Deliberately unfiltered — the "Showing N of M" line reports the filtered view
 * — and deliberately none of what the toolbar already states. The status pills
 * carry the per-status counts and the priority popover carries the per-tier
 * counts, so a header that repeated either would spend the page's most valuable
 * strip restating its own controls, which is what the tile row it replaced did.
 */
export function collectionSummary(watches: Watch[], now: Date = new Date()): CollectionSummary {
  let freshOffers = 0;
  let wishlistValueUsd = 0;
  for (const watch of watches) {
    const offer = bestOffer(watch, undefined, now);
    if (offer.status === "available" && offer.offer.freshness === "fresh") freshOffers += 1;
    if (watch.status !== "owned") wishlistValueUsd += landedPriceUsd(watch) ?? 0;
  }
  return {
    tracked: watches.length,
    freshOffers,
    wishlistValueUsd,
    atTarget: watchesAtTarget(watches).length,
  };
}
