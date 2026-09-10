"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Watch,
  WatchStatus,
  WATCH_STATUSES,
  WishlistTier,
  WISHLIST_TIERS,
  WISHLIST_TIER_LABELS,
} from "@/lib/types";
import { IS_STATIC } from "@/lib/config";
import { landedPriceUsd, type StandingSummary } from "@/lib/scoring";
import { bestOffer, FreshnessTier } from "@/lib/valuation";
import { useCollectionSearch } from "./CollectionSearchContext";
import WatchCard from "./WatchCard";

type SortKey =
  | "wishlistTier"
  | "valueScore"
  | "qualityScore"
  | "offerFreshness"
  | "dateAdded"
  | "priceAsc"
  | "priceDesc"
  | "brand"
  | "caseSize";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "wishlistTier", label: "Wishlist priority" },
  { key: "valueScore", label: "Rubric value" },
  { key: "qualityScore", label: "Quality score" },
  { key: "offerFreshness", label: "Best-offer freshness" },
  { key: "dateAdded", label: "Recently added" },
  { key: "priceAsc", label: "Price: low to high" },
  { key: "priceDesc", label: "Price: high to low" },
  { key: "brand", label: "Brand A–Z" },
  { key: "caseSize", label: "Case size" },
];

/** Sort key for an optional score. Unrated sorts last; -1 rather than -Infinity
 *  so that two unrated watches subtract to 0 and fall through to the tiebreak
 *  instead of producing NaN. */
function rank(score: number | null | undefined): number {
  return score ?? -1;
}

function tierRank(tier?: WishlistTier): number {
  if (!tier) return Infinity;
  const index = WISHLIST_TIERS.indexOf(tier);
  return index === -1 ? Infinity : index;
}

const FRESHNESS_RANK: Record<FreshnessTier, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
  expired: 3,
};

export default function CollectionView({
  watches,
  scoreSummaries = {},
}: {
  watches: Watch[];
  scoreSummaries?: Record<string, StandingSummary>;
}) {
  const router = useRouter();
  const { query, setQuery } = useCollectionSearch();
  const [status, setStatus] = useState<WatchStatus | "all">("all");
  const [wishlistTiers, setWishlistTiers] = useState<WishlistTier[]>([]);
  const [freshOffersOnly, setFreshOffersOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("wishlistTier");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const selectedTierSet = useMemo(() => new Set(wishlistTiers), [wishlistTiers]);
  const offerByWatch = useMemo(() => {
    const now = new Date();
    return new Map(watches.map((watch) => [watch.id, bestOffer(watch, undefined, now)]));
  }, [watches]);
  const priorityLabel = useMemo(() => {
    if (wishlistTiers.length === 0 || wishlistTiers.length === WISHLIST_TIERS.length) return "All priorities";
    if (wishlistTiers.length === 1) return WISHLIST_TIER_LABELS[wishlistTiers[0]];
    return `${wishlistTiers.length} priorities`;
  }, [wishlistTiers]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectionMessage(null);
      } else if (next.size < 4) {
        next.add(id);
        setSelectionMessage(null);
      } else {
        setSelectionMessage("Compare up to four watches at a time.");
      }
      return next;
    });
  }

  function resetFilters() {
    setStatus("all");
    setWishlistTiers([]);
    setFreshOffersOnly(false);
    setQuery("");
  }

  async function changeWishlistTier(id: string, next: WishlistTier | "") {
    try {
      const res = await fetch(`/api/watches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistTier: next || null }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Couldn't update wishlist priority. Please try again.");
    }
  }

  function toggleWishlistTier(tier: WishlistTier) {
    setWishlistTiers((current) => (current.includes(tier) ? current.filter((item) => item !== tier) : [...current, tier]));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = watches.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (selectedTierSet.size > 0 && (!w.wishlistTier || !selectedTierSet.has(w.wishlistTier))) return false;
      if (freshOffersOnly) {
        const offer = offerByWatch.get(w.id);
        if (offer?.status !== "available" || offer.offer.freshness !== "fresh") return false;
      }
      if (!q) return true;
      const haystack = [
        w.brand,
        w.model,
        w.referenceNumber,
        w.wishlistTier ? WISHLIST_TIER_LABELS[w.wishlistTier] : null,
        scoreSummaries[w.id]?.standing.peerLabel,
        ...w.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "wishlistTier":
          return tierRank(a.wishlistTier) - tierRank(b.wishlistTier) || b.dateAdded.localeCompare(a.dateAdded);
        case "valueScore":
          return (
            rank(scoreSummaries[b.id]?.standing.valueScore) - rank(scoreSummaries[a.id]?.standing.valueScore) ||
            rank(scoreSummaries[b.id]?.designScore) - rank(scoreSummaries[a.id]?.designScore) ||
            b.dateAdded.localeCompare(a.dateAdded)
          );
        case "qualityScore":
          return (
            rank(scoreSummaries[b.id]?.standing.qualityScore) - rank(scoreSummaries[a.id]?.standing.qualityScore) ||
            b.dateAdded.localeCompare(a.dateAdded)
          );
        case "offerFreshness": {
          const offerA = offerByWatch.get(a.id);
          const offerB = offerByWatch.get(b.id);
          const rankA = offerA?.status === "available" ? FRESHNESS_RANK[offerA.offer.freshness] : Infinity;
          const rankB = offerB?.status === "available" ? FRESHNESS_RANK[offerB.offer.freshness] : Infinity;
          const ageA = offerA?.status === "available" ? offerA.offer.ageDays : Infinity;
          const ageB = offerB?.status === "available" ? offerB.offer.ageDays : Infinity;
          return rankA - rankB || ageA - ageB || b.dateAdded.localeCompare(a.dateAdded);
        }
        case "priceAsc":
          return (landedPriceUsd(a) ?? Infinity) - (landedPriceUsd(b) ?? Infinity);
        case "priceDesc":
          return (landedPriceUsd(b) ?? -Infinity) - (landedPriceUsd(a) ?? -Infinity);
        case "brand":
          return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
        case "caseSize":
          return (a.specs.caseDiameterMm ?? Infinity) - (b.specs.caseDiameterMm ?? Infinity);
        case "dateAdded":
        default:
          return b.dateAdded.localeCompare(a.dateAdded);
      }
    });
    return list;
  }, [watches, query, status, selectedTierSet, freshOffersOnly, offerByWatch, sort, scoreSummaries]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: watches.length };
    for (const s of WATCH_STATUSES) c[s] = watches.filter((w) => w.status === s).length;
    return c;
  }, [watches]);

  const wishlistTierCounts = useMemo(() => {
    const c = Object.fromEntries(WISHLIST_TIERS.map((tier) => [tier, 0])) as Record<WishlistTier, number>;
    for (const watch of watches) {
      if (watch.wishlistTier) c[watch.wishlistTier] += 1;
    }
    return c;
  }, [watches]);

  function startCompare() {
    if (selected.size < 2) return;
    // Selection survives filtering, so use the source collection rather than
    // the currently visible subset when building the comparison URL.
    const ids = watches.filter((w) => selected.has(w.id)).map((w) => w.id);
    router.push(`/compare?ids=${ids.join(",")}`);
  }

  const hasActiveFilters = status !== "all" || wishlistTiers.length > 0 || freshOffersOnly || query.trim() !== "";

  if (watches.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-4 p-12 text-center">
        <span className="text-4xl">⌚</span>
        <div>
          <h2 className="text-lg font-semibold">No watches yet</h2>
          <p className="text-sm text-slate-500">Add your first watch to start tracking and comparing.</p>
        </div>
        {!IS_STATIC && (
          <Link href="/watch/new" className="btn-primary">
            + Add your first watch
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Total" value={String(counts.all)} />
        <Stat label="Next purchase" value={String(wishlistTierCounts["next-purchase"])} />
        <Stat label="Must have" value={String(wishlistTierCounts["must-have"])} />
        <Stat label="Owned" value={String(counts.owned)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(["all", ...WATCH_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
        <details className="relative sm:w-56">
          <summary className="input flex h-[2.375rem] cursor-pointer list-none items-center justify-between gap-2 py-1.5 [&::-webkit-details-marker]:hidden">
            <span className="truncate">{priorityLabel}</span>
            <span aria-hidden className="text-slate-400">▾</span>
          </summary>
          <div className="absolute z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
              <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-900" onClick={() => setWishlistTiers([])}>
                Clear
              </button>
            </div>
            <div className="space-y-1">
              {WISHLIST_TIERS.map((tier) => (
                <label key={tier} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTierSet.has(tier)}
                      onChange={() => toggleWishlistTier(tier)}
                      className="h-4 w-4 accent-slate-900"
                    />
                    <span>{WISHLIST_TIER_LABELS[tier]}</span>
                  </span>
                  <span className="text-xs text-slate-400">{wishlistTierCounts[tier]}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
        <button
          type="button"
          aria-pressed={freshOffersOnly}
          onClick={() => setFreshOffersOnly((current) => !current)}
          className={`h-[2.375rem] rounded-lg px-3 text-sm font-medium ring-1 transition-colors ${
            freshOffersOnly
              ? "bg-emerald-700 text-white ring-emerald-700"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          Fresh offers only
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input sm:ml-auto sm:max-w-[12rem]">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500" aria-live="polite">
        <p>
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of {watches.length} watches
        </p>
        {hasActiveFilters && filtered.length > 0 && (
          <button type="button" className="font-medium text-slate-700 underline-offset-4 hover:underline" onClick={resetFilters}>
            Clear search and filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No watches match your search and filters.</p>
          <p className="text-xs text-slate-500">Clear them to return to the full collection.</p>
          <button type="button" className="btn-secondary" onClick={resetFilters}>Clear search and filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((watch) => (
            <WatchCard
              key={watch.id}
              watch={watch}
              selected={selected.has(watch.id)}
              selectionDisabled={!selected.has(watch.id) && selected.size >= 4}
              scoreSummary={scoreSummaries[watch.id]}
              onToggleSelect={toggleSelect}
              onChangeWishlistTier={IS_STATIC ? undefined : changeWishlistTier}
            />
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto w-fit max-w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl sm:rounded-full sm:px-5">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>{selected.size} of 4 selected{selected.size < 2 ? " · choose one more" : ""}</span>
            <button onClick={startCompare} disabled={selected.size < 2} className="rounded-full bg-white px-3 py-1 font-medium text-slate-900 disabled:opacity-50">
              Compare →
            </button>
            <button
              onClick={() => {
                setSelected(new Set());
                setSelectionMessage(null);
              }}
              className="text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
          {selectionMessage && <p className="mt-1 text-center text-xs text-amber-200" role="status">{selectionMessage}</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-0 px-3 py-3 sm:px-4">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}
