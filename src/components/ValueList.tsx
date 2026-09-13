"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatMoney, titleCase } from "@/lib/format";
import { caliberTier, deriveCategory, landedPriceUsd, StandingSummary, toDisplayScore } from "@/lib/scoring";
import { SCORING_CATEGORIES, Watch, WatchStatus, WISHLIST_TIERS, WISHLIST_TIER_LABELS, WishlistTier } from "@/lib/types";
import { bestOffer, bestOfferTargetStatus, dealScore } from "@/lib/valuation";
import { compareValueRows, matchesValueFilters, ValueFilters, ValueRow, ValueSortKey } from "@/lib/value-list";
import { matchesWatchSearch } from "@/lib/watch-search";
import { useValueFilters } from "@/hooks/useResearchSession";
import EvidenceCoverage from "./EvidenceCoverage";
import FreshnessBadge from "./FreshnessBadge";

const SORTS: Array<{ value: ValueSortKey; label: string }> = [
  { value: "value", label: "Rubric value: high to low" },
  { value: "deal", label: "Deal: best discount" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "size", label: "Case size" },
  { value: "design", label: "Design rank" },
  { value: "recent", label: "Recently added" },
  { value: "name", label: "Brand / model" },
];

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function ValueList({
  watches,
  summaries,
  nowIso,
}: {
  watches: Watch[];
  summaries: Record<string, StandingSummary>;
  nowIso: string;
}) {
  const { filters: session, update } = useValueFilters();
  const { query, sort, status, category, minPrice, maxPrice, minDesign, confidence, hasDealEvidence, wishlistTier } = session;

  const rows = useMemo(() => {
    const now = new Date(nowIso);
    return watches
      .filter((watch) => watch.status !== "sold")
      .map((watch): ValueRow => {
        const offer = bestOffer(watch, undefined, now);
        return {
          watch,
          summary: summaries[watch.id],
          category: deriveCategory(watch),
          priceUsd: landedPriceUsd(watch),
          deal: dealScore(watch, undefined, now),
          offer,
          targetMet: bestOfferTargetStatus(watch, offer)?.met ?? false,
        };
      });
  }, [watches, summaries, nowIso]);

  const filters: ValueFilters = {
    status,
    category,
    minPrice: numberOrUndefined(minPrice),
    maxPrice: numberOrUndefined(maxPrice),
    minDesign: numberOrUndefined(minDesign),
    confidence,
    hasDealEvidence,
    wishlistTier,
  };
  const visible = rows.filter((row) => matchesValueFilters(row, filters) && matchesWatchSearch(row.watch, query)).sort((a, b) => compareValueRows(a, b, sort));

  function resetFilters() {
    update({ query: "", status: "wishlist", category: "all", minPrice: "", maxPrice: "", minDesign: "", confidence: "all", hasDealEvidence: false, wishlistTier: "all" });
  }

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-end gap-3">
          <label className="label min-w-0 flex-1">
            Search watches
            <input type="search" className="input mt-1" placeholder="Brand, model, reference, or caliber" value={query} onChange={event => update({ query: event.target.value }, true)} />
          </label>
          {query && <button type="button" className="btn-secondary shrink-0" onClick={() => update({ query: "" })}>Clear search</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Sort by">
            <select className="input" value={sort} onChange={(event) => update({ sort: event.target.value as ValueSortKey })}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Filter>
          <Filter label="Status">
            <select className="input" value={status} onChange={(event) => update({ status: event.target.value as WatchStatus | "all" })}>
              <option value="wishlist">Wishlist</option><option value="owned">Owned</option><option value="all">Wishlist + owned</option>
            </select>
          </Filter>
          <Filter label="Category">
            <select className="input" value={category} onChange={(event) => update({ category: event.target.value as ValueFilters["category"] })}>
              <option value="all">All categories</option>
              {SCORING_CATEGORIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </Filter>
          <Filter label="Wishlist priority">
            <select className="input" value={wishlistTier} onChange={(event) => update({ wishlistTier: event.target.value as WishlistTier | "all" })}>
              <option value="all">All priorities</option>
              {WISHLIST_TIERS.map((tier) => <option key={tier} value={tier}>{WISHLIST_TIER_LABELS[tier]}</option>)}
            </select>
          </Filter>
          <Filter label="Minimum USD price"><input className="input" inputMode="numeric" value={minPrice} onChange={(event) => update({ minPrice: event.target.value }, true)} placeholder="No minimum" /></Filter>
          <Filter label="Maximum USD price"><input className="input" inputMode="numeric" value={maxPrice} onChange={(event) => update({ maxPrice: event.target.value }, true)} placeholder="No maximum" /></Filter>
          <Filter label="Minimum design rank">
            <select className="input" value={minDesign} onChange={(event) => update({ minDesign: event.target.value })}>
              <option value="">Any / unrated</option><option value="3">3+</option><option value="4">4+</option><option value="5">5</option>
            </select>
          </Filter>
          <Filter label="Evidence coverage">
            <select className="input" value={confidence} onChange={(event) => update({ confidence: event.target.value as ValueFilters["confidence"] })}>
              <option value="all">All coverage levels</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low / limited</option>
            </select>
          </Filter>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-cocoa-600">
            <input type="checkbox" checked={hasDealEvidence} onChange={(event) => update({ hasDealEvidence: event.target.checked })} />
            Has sufficient deal evidence
          </label>
          <button type="button" onClick={resetFilters} className="text-sm font-medium text-azalea-700 hover:underline">Reset filters</button>
        </div>
      </section>

      <p role="status" className="text-sm text-cocoa-500">Showing {visible.length} of {rows.length} wishlist or owned watches. Rubric value is the ranking; deal evidence and design stay separate.</p>

      <section className="card overflow-hidden">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-cocoa-500">No watches match your search and filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="border-b border-cocoa-200 bg-cocoa-50 text-xs uppercase tracking-wide text-cocoa-500">
                <tr><th className="px-4 py-3">Watch</th><th className="px-3 py-3">Rubric value</th><th className="px-3 py-3">Deal vs fair asks</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Best dated offer</th><th className="px-3 py-3">Specs</th><th className="px-3 py-3">Design</th><th className="px-3 py-3">Target</th></tr>
              </thead>
              <tbody className="divide-y divide-cocoa-100">
                {visible.map((row, index) => <ValueTableRow key={row.watch.id} row={row} rank={sort === "value" ? index + 1 : undefined} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="label">{label}{children}</label>;
}

function ValueTableRow({ row, rank }: { row: ValueRow; rank?: number }) {
  const { watch, summary, deal, offer } = row;
  const standing = summary.standing;
  const movementTier = caliberTier(watch.specs.caliber, watch.specs.movement);
  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{rank ? `#${rank} · ` : ""}{watch.brand}</p>
        <Link href={`/watch/${watch.id}`} className="font-semibold text-cocoa-900 hover:underline">{watch.model}</Link>
        <p className="mt-1 text-xs text-cocoa-500">{watch.status === "wishlist" && watch.wishlistTier ? WISHLIST_TIER_LABELS[watch.wishlistTier] : titleCase(watch.status)}</p>
      </td>
      <td className="px-3 py-4">
        {standing.valueScore === undefined ? <p className="font-semibold text-cocoa-500">Not scored</p> : <p className="text-lg font-bold text-cocoa-900">{Math.round(toDisplayScore(standing.valueScore))}</p>}
        <EvidenceCoverage watch={watch} standing={standing} />
      </td>
      <td className="px-3 py-4">
        {deal.status === "available" ? <><p className="font-semibold">{formatDiscount(deal.discountPct)}</p><p className="text-xs text-cocoa-500">Fair {formatMoney({ amount: deal.fairLowUsd, currency: "USD" })}–{formatMoney({ amount: deal.fairHighUsd, currency: "USD" })}</p></> : <><p className="font-semibold text-cocoa-500">Insufficient</p><p className="text-xs text-cocoa-400">No discount calculated</p></>}
      </td>
      <td className="px-3 py-4"><p className="font-semibold">{formatMoney(watch.landedPrice ?? watch.price)}</p><p className="text-xs text-cocoa-500">{watch.landedPrice ? "Landed" : watch.price ? "Tracked" : "No price"}</p></td>
      <td className="px-3 py-4">
        {offer.status === "available" ? <><a href={offer.offer.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-azalea-700 hover:underline">{formatMoney(offer.offer.price)} ↗</a><p className="mt-1 text-xs text-cocoa-500">{offer.offer.source}</p><div className="mt-1"><FreshnessBadge tier={offer.offer.freshness} ageDays={offer.offer.ageDays} compact /></div></> : <p className="text-cocoa-500">No dated offer</p>}
      </td>
      <td className="px-3 py-4 text-xs"><p>{row.category ? titleCase(row.category) : "Category unrated"}</p><p className="text-cocoa-500">{watch.specs.caseDiameterMm ? `${watch.specs.caseDiameterMm} mm` : "Size unrated"}</p><p className="text-cocoa-500">{watch.specs.caliber ?? watch.specs.movement ?? "Movement unrated"}{movementTier !== undefined ? ` · tier ${Math.round(movementTier * 100)}` : ""}</p></td>
      <td className="px-3 py-4"><p className="font-semibold">{watch.designUniqueness ? `${watch.designUniqueness} / 5` : "Unrated"}</p>{summary.designScore !== null && <p className="text-xs text-cocoa-500">Score {Math.round(summary.designScore)}</p>}</td>
      <td className="px-3 py-4">{row.targetMet ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Target met</span> : watch.targetPrice ? <span className="text-xs text-cocoa-500">Target {formatMoney(watch.targetPrice)}</span> : <span className="text-cocoa-400">—</span>}</td>
    </tr>
  );
}

function formatDiscount(discount: number): string {
  if (discount > 0.5) return `${Math.round(discount)}% below fair asks`;
  if (discount < -0.5) return `${Math.round(Math.abs(discount))}% above fair asks`;
  return "At fair median";
}
