"use client";

import Link from "next/link";
import { toDisplayScore, type StandingSummary } from "@/lib/scoring";
import { DIMENSION_LABELS } from "@/lib/rubrics";
import { Watch, WishlistTier, WISHLIST_TIERS, WISHLIST_TIER_LABELS } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { targetStatus } from "@/lib/price-history";
import StatusBadge from "./StatusBadge";
import WishlistTierBadge from "./WishlistTierBadge";

function initials(watch: Watch): string {
  const a = watch.brand?.trim()?.[0] ?? "?";
  const b = watch.model?.trim()?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function WatchCard({
  watch,
  selected,
  scoreSummary,
  onToggleSelect,
  onChangeWishlistTier,
}: {
  watch: Watch;
  selected: boolean;
  scoreSummary?: StandingSummary;
  onToggleSelect: (id: string) => void;
  onChangeWishlistTier?: (id: string, next: WishlistTier | "") => void;
}) {
  const { specs } = watch;
  const target = targetStatus(watch);
  return (
    <div className={`card group relative overflow-hidden transition-shadow hover:shadow-md ${selected ? "ring-2 ring-slate-900" : ""}`}>
      {/* Stretched overlay link: the whole card navigates to the detail page.
          Interactive controls sit above it via z-index. */}
      <Link
        href={`/watch/${watch.id}`}
        aria-label={`${watch.brand} ${watch.model}`}
        className="absolute inset-0 z-10"
      />
      <div className="relative flex h-64 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={watch.imageUrl} alt={`${watch.brand} ${watch.model}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-slate-400">{initials(watch)}</span>
        )}
        <label className="absolute right-2 top-2 z-20 flex cursor-pointer items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(watch.id)}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          Compare
        </label>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{watch.brand}</p>
            <p className="truncate font-semibold group-hover:underline">{watch.model}</p>
            {watch.referenceNumber && (
              <p className="truncate text-xs text-slate-400">Ref. {watch.referenceNumber}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
            <WishlistTierBadge tier={watch.wishlistTier} />
            <StatusBadge status={watch.status} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{formatMoney(watch.price)}</span>
            {target?.met && (
              <span
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                title={`At or below your ${formatMoney(target.target)} target`}
              >
                at target
              </span>
            )}
          </span>
          <span className="text-xs text-slate-500">
            {[specs.caseDiameterMm ? `${specs.caseDiameterMm}mm` : null, specs.movement].filter(Boolean).join(" · ")}
          </span>
        </div>
        {scoreSummary && <StandingBlock summary={scoreSummary} />}
        {onChangeWishlistTier && (
          <select
            value={watch.wishlistTier ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChangeWishlistTier(watch.id, e.target.value as WishlistTier | "");
            }}
            aria-label={`Set wishlist priority for ${watch.brand} ${watch.model}`}
            className="input relative z-20 h-8 py-1 text-xs"
          >
            <option value="">Set priority</option>
            {WISHLIST_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {WISHLIST_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        )}
        {watch.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {watch.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StandingBlock({ summary }: { summary: StandingSummary }) {
  const { standing } = summary;
  const dimensionList = (dimensions: typeof standing.beats) =>
    dimensions.map((dimension) => DIMENSION_LABELS[dimension]).join(", ");

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex flex-wrap gap-1">
        <span
          title={`Quality against what ${standing.peerLabel} should buy, adjusted for where the price sits in the band. 50 is par.`}
          className="rounded-full bg-slate-900 px-2 py-1 font-medium text-white"
        >
          {standing.valueScore === undefined
            ? "Value unrated"
            : `Value ${Math.round(toDisplayScore(standing.valueScore))}`}
        </span>
        <span title="Composite of the rated dimensions" className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
          {standing.qualityScore === undefined
            ? "Quality unrated"
            : `Quality ${Math.round(toDisplayScore(standing.qualityScore))}`}
        </span>
        <span
          title={summary.designScore === null ? "Not yet ranked for design" : "Your design rank"}
          className={`rounded-full px-2 py-1 font-medium ${
            summary.designScore === null ? "bg-slate-50 text-slate-400" : "bg-slate-100 text-slate-600"
          }`}
        >
          {summary.designScore === null ? "Design unranked" : `Design ${Math.round(summary.designScore)}`}
        </span>
      </div>

      <p className="text-slate-500">
        {standing.peerLabel}
        {standing.qualityPercentile !== undefined && ` · ${Math.round(standing.qualityPercentile * 100)}th pct of ${standing.peerCount}`}
      </p>

      {standing.beats.length > 0 && (
        <p className="text-emerald-700">Beats band on {dimensionList(standing.beats)}</p>
      )}
      {standing.trails.length > 0 && (
        <p className="text-amber-700">Trails band on {dimensionList(standing.trails)}</p>
      )}
      {standing.unrated.length > 0 && (
        <p className="text-slate-400" title="No source data recorded for these dimensions, so they are excluded from the scores">
          Unrated: {dimensionList(standing.unrated)}
        </p>
      )}

      {standing.frictions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {standing.frictions.map((friction) => (
            <span key={friction} className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
              {friction}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
