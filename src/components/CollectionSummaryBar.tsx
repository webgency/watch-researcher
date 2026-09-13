import type { CollectionSummary } from "@/lib/collection-summary";
import { formatMoney } from "@/lib/format";

function Stat({
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  label: string;
  value: string;
  /** Context for the number ("of 72"), set smaller so the figure stays the thing you read. */
  suffix?: string;
  hint?: string;
  tone?: "good";
}) {
  return (
    <div className="min-w-0" title={hint}>
      <p className="text-sm text-cocoa-500">{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${tone === "good" ? "text-emerald-700" : "text-cocoa-900"}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-medium tracking-normal text-cocoa-500">{suffix}</span>}
      </p>
    </div>
  );
}

/**
 * Sits opposite the page title rather than in a row of its own. The four tiles
 * this replaced took the widest strip on the page to restate the status pills
 * and the priority counts, and kept a permanent box for a tier that is usually
 * empty — while the space beside the heading went unused.
 */
export default function CollectionSummaryBar({ summary }: { summary: CollectionSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:gap-x-8">
      <Stat label="Tracked" value={String(summary.tracked)} />
      <Stat
        label="Wishlist value"
        value={formatMoney({ amount: summary.wishlistValueUsd, currency: "USD" })}
        hint="Landed USD for everything not marked owned"
      />
      <Stat
        label="Fresh offers"
        value={String(summary.freshOffers)}
        suffix={`of ${summary.tracked}`}
        hint="Watches whose best dated retailer offer is still inside the fresh window"
      />
      {/* Shown only when it fires. A target nothing has met yet is a zero with no
          action attached, and a permanently-zero figure is precisely what made
          the previous tile row worth replacing. */}
      {summary.atTarget > 0 && <Stat label="At target" value={String(summary.atTarget)} tone="good" />}
    </div>
  );
}
