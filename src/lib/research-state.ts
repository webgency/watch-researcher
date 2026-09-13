import { SCORING_CATEGORIES, WATCH_STATUSES, WISHLIST_TIERS, type WatchStatus, type WishlistTier } from "./types";
import type { ValueSortKey } from "./value-list";

export const COLLECTION_SORTS = ["wishlistTier", "valueScore", "qualityScore", "offerFreshness", "dateAdded", "priceAsc", "priceDesc", "brand", "caseSize"] as const;
export type CollectionSort = typeof COLLECTION_SORTS[number];
export interface CollectionFilters {
  query: string; status: WatchStatus | "all"; wishlistTiers: WishlistTier[];
  freshOffersOnly: boolean; sort: CollectionSort;
}
export interface ValueSearchFilters {
  query: string; status: WatchStatus | "all"; sort: ValueSortKey;
  category: typeof SCORING_CATEGORIES[number] | "all";
  minPrice: string; maxPrice: string; minDesign: string;
  confidence: "all" | "high" | "medium" | "low";
  hasDealEvidence: boolean; wishlistTier: WishlistTier | "all";
}
function choice<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}
function amount(value: string | null): string {
  return value?.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : "";
}
export function readCollectionFilters(params: URLSearchParams): CollectionFilters {
  return {
    query: params.get("q") ?? "", status: choice(params.get("status"), ["all", ...WATCH_STATUSES], "all"),
    wishlistTiers: WISHLIST_TIERS.filter(tier => (params.get("priority") ?? "").split(",").includes(tier)),
    freshOffersOnly: params.get("fresh") === "1", sort: choice(params.get("sort"), COLLECTION_SORTS, "wishlistTier"),
  };
}
export function readValueFilters(params: URLSearchParams): ValueSearchFilters {
  return {
    query: params.get("q") ?? "", status: choice(params.get("status"), ["all", "wishlist", "owned"], "wishlist"),
    sort: choice(params.get("sort"), ["value", "deal", "price-asc", "price-desc", "size", "design", "recent", "name"], "value"),
    category: choice(params.get("category"), ["all", ...SCORING_CATEGORIES], "all"),
    minPrice: amount(params.get("min")), maxPrice: amount(params.get("max")),
    minDesign: choice(params.get("design"), ["", "3", "4", "5"], ""),
    confidence: choice(params.get("confidence"), ["all", "high", "medium", "low"], "all"),
    hasDealEvidence: params.get("deal") === "1",
    wishlistTier: choice(params.get("priority"), ["all", ...WISHLIST_TIERS], "all"),
  };
}
function put(params: URLSearchParams, key: string, value: string, fallback = "") {
  if (value === fallback) params.delete(key); else params.set(key, value);
}
// Preserve unrelated query parameters while omitting defaults from shareable URLs.
export function writeCollectionFilters(params: URLSearchParams, state: CollectionFilters) {
  put(params, "q", state.query); put(params, "status", state.status, "all");
  put(params, "priority", state.wishlistTiers.join(",")); put(params, "fresh", state.freshOffersOnly ? "1" : "");
  put(params, "sort", state.sort, "wishlistTier"); return params;
}
export function writeValueFilters(params: URLSearchParams, state: ValueSearchFilters) {
  put(params, "q", state.query); put(params, "status", state.status, "wishlist");
  put(params, "sort", state.sort, "value"); put(params, "category", state.category, "all");
  put(params, "min", state.minPrice); put(params, "max", state.maxPrice); put(params, "design", state.minDesign);
  put(params, "confidence", state.confidence, "all"); put(params, "deal", state.hasDealEvidence ? "1" : "");
  put(params, "priority", state.wishlistTier, "all"); return params;
}
export function readSelection(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 4);
  } catch { return []; }
}
export function safeResearchUrl(raw: string, route: "/" | "/value"): string {
  // Only relative URLs for the exact research page can become navigation links.
  if (raw.split("?")[0] !== route) return route;
  return raw;
}
