"use client";

import Link from "next/link";
import { Watch } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import StatusBadge from "./StatusBadge";

function initials(watch: Watch): string {
  const a = watch.brand?.trim()?.[0] ?? "?";
  const b = watch.model?.trim()?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function WatchCard({
  watch,
  selected,
  onToggleSelect,
  onToggleFavorite,
}: {
  watch: Watch;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  const { specs } = watch;
  return (
    <div className={`card group relative overflow-hidden transition-shadow hover:shadow-md ${selected ? "ring-2 ring-slate-900" : ""}`}>
      {/* Stretched overlay link: the whole card navigates to the detail page.
          Interactive controls (favorite, Compare) sit above it via z-index. */}
      <Link
        href={`/watch/${watch.id}`}
        aria-label={`${watch.brand} ${watch.model}`}
        className="absolute inset-0 z-10"
      />
      <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={watch.imageUrl} alt={`${watch.brand} ${watch.model}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-slate-400">{initials(watch)}</span>
        )}
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(watch.id, !watch.favorite);
              }}
              aria-pressed={Boolean(watch.favorite)}
              aria-label={watch.favorite ? "Remove from favorites" : "Add to favorites"}
              title={watch.favorite ? "Remove from favorites" : "Add to favorites"}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-sm transition-colors ${
                watch.favorite ? "bg-rose-600 text-white" : "bg-white/90 text-slate-400 hover:text-rose-600"
              }`}
            >
              ♥
            </button>
          ) : (
            watch.favorite && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white shadow-sm">♥</span>
            )
          )}
          {watch.grail && (
            <span className="rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-semibold text-yellow-950">★ Grail</span>
          )}
        </div>
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
          <StatusBadge status={watch.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">{formatMoney(watch.price)}</span>
          <span className="text-xs text-slate-500">
            {[specs.caseDiameterMm ? `${specs.caseDiameterMm}mm` : null, specs.movement].filter(Boolean).join(" · ")}
          </span>
        </div>
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
