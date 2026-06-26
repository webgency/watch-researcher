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
import { useCollectionSearch } from "./CollectionSearchContext";
import WatchCard from "./WatchCard";

type SortKey =
  | "wishlistTier"
  | "dateAdded"
  | "priceAsc"
  | "priceDesc"
  | "brand"
  | "caseSize";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "wishlistTier", label: "Desirability" },
  { key: "dateAdded", label: "Recently added" },
  { key: "priceAsc", label: "Price: low to high" },
  { key: "priceDesc", label: "Price: high to low" },
  { key: "brand", label: "Brand A–Z" },
  { key: "caseSize", label: "Case size" },
];

function tierRank(tier?: WishlistTier): number {
  if (!tier) return Infinity;
  const index = WISHLIST_TIERS.indexOf(tier);
  return index === -1 ? Infinity : index;
}

export default function CollectionView({ watches }: { watches: Watch[] }) {
  const router = useRouter();
  const { query } = useCollectionSearch();
  const [status, setStatus] = useState<WatchStatus | "all">("all");
  const [wishlistTier, setWishlistTier] = useState<WishlistTier | "all">("all");
  const [sort, setSort] = useState<SortKey>("wishlistTier");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      alert("Couldn't update desirability. Please try again.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = watches.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (wishlistTier !== "all" && w.wishlistTier !== wishlistTier) return false;
      if (!q) return true;
      const haystack = [
        w.brand,
        w.model,
        w.referenceNumber,
        w.wishlistTier ? WISHLIST_TIER_LABELS[w.wishlistTier] : null,
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
        case "priceAsc":
          return (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity);
        case "priceDesc":
          return (b.price?.amount ?? -Infinity) - (a.price?.amount ?? -Infinity);
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
  }, [watches, query, status, wishlistTier, sort]);

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
    const ids = filtered.filter((w) => selected.has(w.id)).map((w) => w.id);
    router.push(`/compare?ids=${ids.join(",")}`);
  }

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
          {(["all", "owned", "sold"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
        <select
          value={wishlistTier}
          onChange={(e) => setWishlistTier(e.target.value as WishlistTier | "all")}
          className="input sm:max-w-[13rem]"
        >
          <option value="all">All desirability</option>
          {WISHLIST_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {WISHLIST_TIER_LABELS[tier]} ({wishlistTierCounts[tier]})
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input sm:ml-auto sm:max-w-[12rem]">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No watches match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((watch) => (
            <WatchCard
              key={watch.id}
              watch={watch}
              selected={selected.has(watch.id)}
              onToggleSelect={toggleSelect}
              onChangeWishlistTier={IS_STATIC ? undefined : changeWishlistTier}
            />
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
          <span>{selected.size} selected</span>
          <button onClick={startCompare} disabled={selected.size < 2} className="rounded-full bg-white px-3 py-1 font-medium text-slate-900 disabled:opacity-50">
            Compare →
          </button>
          <button onClick={() => setSelected(new Set())} className="text-slate-300 hover:text-white">
            Clear
          </button>
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
