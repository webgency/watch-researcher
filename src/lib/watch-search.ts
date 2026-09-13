import { type Watch, WISHLIST_TIER_LABELS } from "./types";

/** Space-separated terms can match different fields (for example brand + caliber). */
export function matchesWatchSearch(watch: Watch, query: string, extra: string[] = []): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = [
    watch.brand, watch.model, watch.referenceNumber, watch.specs.caliber,
    watch.specs.movement, watch.wishlistTier ? WISHLIST_TIER_LABELS[watch.wishlistTier] : undefined,
    ...watch.tags, ...extra,
  ].filter(Boolean).join(" ").toLowerCase();
  return terms.every(term => text.includes(term));
}
