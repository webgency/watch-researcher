import type { CollectionSummary } from "@/lib/collection-summary";
import { formatMoney } from "@/lib/format";

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" }) {
  return (
    <div className="min-w-0" title={hint}>
      <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tone === "good" ? "text-emerald-700" : "text-cocoa-900"}`}>
        {value}
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
        value={`${summary.freshOffers} of ${summary.tracked}`}
        hint="Watches whose best dated retailer offer is still inside the fresh window"
      />
      {/* Shown only when it fires. A target nothing has met yet is a zero with no
          action attached, and a permanently-zero figure is precisely what made
          the previous tile row worth replacing. */}
      {summary.atTarget > 0 && <Stat label="At target" value={String(summary.atTarget)} tone="good" />}
    </div>
  );
}
