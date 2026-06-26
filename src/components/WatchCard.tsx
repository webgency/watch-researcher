"use client";

import Link from "next/link";
import { Watch, WishlistTier, WISHLIST_TIERS, WISHLIST_TIER_LABELS } from "@/lib/types";
import { formatMoney } from "@/lib/format";
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
  onToggleSelect,
  onChangeWishlistTier,
}: {
  watch: Watch;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onChangeWishlistTier?: (id: string, next: WishlistTier | "") => void;
}) {
  const { specs } = watch;
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
          <span className="text-lg font-bold">{formatMoney(watch.price)}</span>
          <span className="text-xs text-slate-500">
            {[specs.caseDiameterMm ? `${specs.caseDiameterMm}mm` : null, specs.movement].filter(Boolean).join(" · ")}
          </span>
        </div>
        {onChangeWishlistTier && (
          <select
            value={watch.wishlistTier ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChangeWishlistTier(watch.id, e.target.value as WishlistTier | "");
            }}
            aria-label={`Set desirability for ${watch.brand} ${watch.model}`}
            className="input relative z-20 h-8 py-1 text-xs"
          >
            <option value="">Set desirability</option>
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
