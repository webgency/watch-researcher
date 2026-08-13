"use client";

import Link from "next/link";
import type { Standing, WatchScoreSummary } from "@/lib/scoring";
import { DIMENSIONS } from "@/lib/rubrics";
import { Watch, WishlistTier, WISHLIST_TIERS, WISHLIST_TIER_LABELS } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import WishlistTierBadge from "./WishlistTierBadge";

const QUADRANT_LABELS: Record<string, string> = {
  buy: "Buy",
  aspirational: "Aspirational",
  sensible: "Sensible",
  skip: "Skip",
};

const QUADRANT_CLASSES: Record<string, string> = {
  buy: "bg-emerald-50 text-emerald-700",
  aspirational: "bg-amber-50 text-amber-700",
  sensible: "bg-sky-50 text-sky-700",
  skip: "bg-slate-100 text-slate-600",
};

function initials(watch: Watch): string {
  const a = watch.brand?.trim()?.[0] ?? "?";
  const b = watch.model?.trim()?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function WatchCard({
  watch,
  selected,
  scoreSummary,
  standing,
  onToggleSelect,
  onChangeWishlistTier,
}: {
  watch: Watch;
  selected: boolean;
  scoreSummary?: WatchScoreSummary;
  standing?: Standing;
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
        {standing && <BandStanding standing={standing} />}
        {scoreSummary && <ScoreSummary summary={scoreSummary} designRank={watch.designUniqueness} />}
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

/**
 * Compact band standing for the grid. The detail page carries the per-dimension
 * meters; here the reader is scanning, so this is only the two headline numbers
 * plus how much evidence sits behind them.
 */
function BandStanding({ standing }: { standing: Standing }) {
  const ratedCount = DIMENSIONS.length - standing.unrated.length;
  if (ratedCount === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        {/* "vs" matters: the chips below carry collection-wide value rank, so
            without it two different numbers both read as plain "Value". */}
        <span
          className="truncate text-[11px] font-medium text-slate-500"
          title={`Scored against the rubric for ${standing.peerLabel}`}
        >
          vs {standing.peerLabel}
        </span>
        <span
          className={`flex-shrink-0 text-[11px] ${ratedCount <= 2 ? "text-amber-700" : "text-slate-400"}`}
          title="Dimensions with enough recorded data to score"
        >
          {ratedCount}/{DIMENSIONS.length} rated
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2.5">
        {/* Quality is a bare magnitude — the rubric sets par per dimension, not
            for the composite, so there is no honest tick to draw on it. */}
        <MiniMeter label="Quality" value={standing.qualityScore} />
        {/* Value is centred on par by construction, so 50 is the line. */}
        <MiniMeter label="Value" value={standing.valueScore} par={0.5} />
      </div>
    </div>
  );
}

function MiniMeter({ label, value, par }: { label: string; value?: number; par?: number }) {
  const pct = value === undefined ? 0 : Math.round(value * 100);
  const beats = par !== undefined && value !== undefined && value > par + 0.05;
  const trails = par !== undefined && value !== undefined && value < par - 0.05;
  const fill = beats ? "bg-emerald-600" : trails ? "bg-amber-600" : "bg-slate-500";
  const track = beats ? "bg-emerald-100" : trails ? "bg-amber-100" : "bg-slate-200";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-800">
          {value === undefined ? "—" : pct}
        </span>
      </div>
      <div
        className={`relative mt-1 h-1.5 overflow-hidden rounded-full ${value === undefined ? "bg-slate-100" : track}`}
        role="img"
        aria-label={
          value === undefined
            ? `${label}: not rated`
            : par === undefined
              ? `${label}: ${pct} of 100`
              : `${label}: ${pct} of 100, par ${Math.round(par * 100)}`
        }
      >
        {value !== undefined && (
          <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        )}
        {par !== undefined && value !== undefined && (
          <div
            className="absolute inset-y-0 w-px -translate-x-1/2 bg-slate-900/60"
            style={{ left: `${Math.round(par * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function ScoreSummary({ summary, designRank }: { summary: WatchScoreSummary; designRank?: number }) {
  const roundedValue = summary.valueScore === null ? null : Math.round(summary.valueScore);
  const quadrantClass = summary.quadrant ? QUADRANT_CLASSES[summary.quadrant] : "bg-slate-100 text-slate-600";

  return (
    <div className="flex flex-wrap gap-1 text-xs">
      <span
        title="Value rank among priced wishlist watches"
        className="rounded-full bg-slate-900 px-2 py-1 font-medium text-white"
      >
        {summary.valueRank ? `Value #${summary.valueRank} · ${roundedValue}` : "Value unrated"}
      </span>
      {/* Shows your 1-5 rank, not the rescaled score — the rank is what you set. */}
      <span
        title={designRank ? "Your design rank" : "Not ranked for design yet"}
        className={`rounded-full px-2 py-1 font-medium ${
          designRank ? "bg-slate-100 text-slate-600" : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200"
        }`}
      >
        {designRank ? `Design ${designRank}/5` : "Design unranked"}
      </span>
      {summary.quadrant && (
        <span className={`rounded-full px-2 py-1 font-medium ${quadrantClass}`}>
          {QUADRANT_LABELS[summary.quadrant]}
        </span>
      )}
    </div>
  );
}
