"use client";

import Link from "next/link";
import type { Watch, WishlistTier } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { toDisplayScore, type StandingSummary } from "@/lib/scoring";
import { bestOffer } from "@/lib/valuation";
import PriorityMenu from "./PriorityMenu";
import WishlistTierBadge from "./WishlistTierBadge";
import StatusBadge from "./StatusBadge";
import FreshnessBadge from "./FreshnessBadge";

/** Presentation only: both collection views consume the same filtered order and selection. */
export default function CollectionTable({ watches, selected, scoreSummaries, onToggleSelect, onChangeWishlistTier }: {
  watches: Watch[];
  selected: Set<string>;
  scoreSummaries: Record<string, StandingSummary>;
  onToggleSelect: (id: string) => void;
  onChangeWishlistTier?: (id: string, next: WishlistTier | "") => Promise<boolean>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-cocoa-500 xl:hidden">Scroll horizontally to see all columns.</p>
    <div className="card overflow-x-auto" role="region" aria-label="Compact collection table, scroll horizontally for more columns" tabIndex={0}>
      <table className="w-full min-w-[1050px] text-left text-sm">
        <caption className="sr-only">Collection in the current filter and sort order</caption>
        <thead className="border-b border-cocoa-200 bg-cocoa-50 text-xs uppercase tracking-wide text-cocoa-500">
          <tr>
            {['Compare', 'Watch', 'Priority', 'Specifications', 'Tracked price', 'Best dated offer', 'Rubric value'].map(label => (
              <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cocoa-100">
          {watches.map(watch => {
            const checked = selected.has(watch.id);
            const disabled = !checked && selected.size >= 4;
            const standing = scoreSummaries[watch.id]?.standing;
            const offer = bestOffer(watch);
            return (
              <tr key={watch.id} className={checked ? "bg-azalea-50" : "hover:bg-cocoa-50/50"}>
                <td className="px-3 py-3 text-center">
                  <input type="checkbox" checked={checked} disabled={disabled}
                    aria-label={`Compare ${watch.brand} ${watch.model}`}
                    aria-describedby={disabled ? "comparison-limit" : undefined}
                    onChange={() => onToggleSelect(watch.id)} className="h-4 w-4 accent-cocoa-900" />
                </td>
                <th scope="row" className="min-w-[240px] max-w-[320px] px-3 py-3 font-normal">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">{watch.brand}</p>
                  <Link href={`/watch/${watch.id}`} className="font-semibold text-cocoa-900 hover:underline">{watch.model}</Link>
                  {watch.referenceNumber && <p className="text-xs text-cocoa-500">Ref. {watch.referenceNumber}</p>}
                  {watch.status !== "wishlist" && <div className="mt-1"><StatusBadge status={watch.status} /></div>}
                </th>
                <td className="whitespace-nowrap px-3 py-3">
                  {onChangeWishlistTier ? (
                    <PriorityMenu tier={watch.wishlistTier} watchName={`${watch.brand} ${watch.model}`} onChange={next => onChangeWishlistTier(watch.id, next)} />
                  ) : watch.wishlistTier ? <WishlistTierBadge tier={watch.wishlistTier} /> : <span className="text-cocoa-500">Not set</span>}
                </td>
                <td className="px-3 py-3">
                  <p>{watch.specs.caseDiameterMm ? `${watch.specs.caseDiameterMm} mm` : "Size unknown"}</p>
                  <p className="text-xs text-cocoa-500">{watch.specs.caliber ?? watch.specs.movement ?? "Movement unknown"}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatMoney(watch.price)}</td>
                <td className="min-w-[185px] px-3 py-3">
                  {offer.status === "available" ? <>
                    <a href={offer.offer.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-azalea-700 hover:underline">{formatMoney(offer.offer.price)} ↗</a>
                    <p className="text-xs text-cocoa-500">{offer.offer.source}</p>
                    <div className="mt-1"><FreshnessBadge tier={offer.offer.freshness} ageDays={offer.offer.ageDays} compact /></div>
                    <p className="mt-1 text-xs text-cocoa-500">{offer.offer.condition ?? "Condition unknown"}{offer.conditionMatch === "fallback" ? " · condition fallback" : ""}</p>
                  </> : <span className="text-xs text-cocoa-500">No dated offers</span>}
                </td>
                <td className="px-3 py-3">
                  {standing?.valueScore !== undefined ? <>
                    <p className="font-semibold">{Math.round(toDisplayScore(standing.valueScore))}</p>
                    <p className="text-xs text-cocoa-500">Evidence {Math.round(standing.evidenceCoverage * 100)}%</p>
                  </> : <span className="text-xs text-cocoa-500">Unrated</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
