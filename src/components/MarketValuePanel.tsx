import { formatAgeDays, formatMoney } from "@/lib/format";
import { Watch } from "@/lib/types";
import {
  bestOffer,
  BestOffer,
  bestOfferTargetStatus,
  BestOfferTargetStatus,
  dealScore,
  DealScore,
  marketValueSummary,
  MarketValueSummary,
} from "@/lib/valuation";
import FreshnessBadge from "./FreshnessBadge";

const CONFIDENCE_STYLE = {
  insufficient: "bg-slate-100 text-slate-600",
  low: "bg-amber-50 text-amber-800",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-emerald-50 text-emerald-700",
};

function ConditionSummary({ summary }: { summary: MarketValueSummary }) {
  const label = summary.condition === "new" ? "New" : "Pre-owned";
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${CONFIDENCE_STYLE[summary.confidence]}`}>
            {summary.confidence === "insufficient" ? "Needs more data" : `${summary.confidence} confidence`}
          </span>
          {summary.freshness && <FreshnessBadge tier={summary.freshness} />}
        </div>
      </div>

      {summary.medianUsd === undefined ? (
        <div className="mt-3 text-sm text-slate-500">
          <p>No estimate yet. Add at least two dated prices from different sellers for {label.toLowerCase()} examples.</p>
          <p className="mt-1 text-xs text-slate-400">{summary.observations.length} qualifying source{summary.observations.length === 1 ? "" : "s"} recorded</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-2xl font-bold text-slate-900">{formatMoney({ amount: summary.medianUsd, currency: "USD" })}</p>
          <p className="text-xs text-slate-500">
            Median asking price · range {formatMoney({ amount: summary.lowUsd!, currency: "USD" })}–{formatMoney({ amount: summary.highUsd!, currency: "USD" })}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {summary.observations.length} independent, condition-matched sources · {ageSummary(summary.observations.map((item) => item.ageDays))}
          </p>
          {(summary.freshness === "stale" || summary.freshness === "expired") && (
            <p className="mt-2 text-xs font-medium text-amber-800">
              This median includes {summary.freshness} evidence; refresh the retailer asks before relying on it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ageSummary(ages: number[]): string {
  if (!ages.length) return "No dated observations";
  const sorted = [...ages].sort((a, b) => a - b);
  if (sorted.length === 1) return formatAgeDays(sorted[0]);
  return `newest ${formatAgeDays(sorted[0])} · oldest ${formatAgeDays(sorted[sorted.length - 1])}`;
}

function BestOfferSummary({ result, target }: { result: BestOffer; target?: BestOfferTargetStatus }) {
  if (result.status === "insufficient") {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">No dated offers</h3>
        <p className="mt-1 text-sm text-slate-600">
          Add a retailer price with an observation date before ranking a best offer.
        </p>
        {result.undatedOfferCount > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {result.undatedOfferCount} undated priced link{result.undatedOfferCount === 1 ? " is" : "s are"} excluded from ranking.
          </p>
        )}
      </div>
    );
  }

  const { offer } = result;
  const condition = offer.condition ?? "condition unknown";
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Best dated offer</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(offer.price)}</p>
          <a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
            {offer.source} ↗
          </a>
        </div>
        <FreshnessBadge tier={offer.freshness} ageDays={offer.ageDays} compact />
      </div>
      <p className="mt-2 text-xs capitalize text-slate-500">{condition}</p>
      {result.conditionMatch === "fallback" && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          No dated {result.preferredCondition} offer was available, so this uses a {offer.condition} offer instead.
        </p>
      )}
      {result.conditionMatch === "unknown" && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          No dated {result.preferredCondition} offer was available; this retailer did not record a condition.
        </p>
      )}
      {target?.met && (
        <p className="mt-2 rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
          Best listed offer is at target; shipping and duty are not recorded for this offer.
        </p>
      )}
      {result.undatedOfferCount > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {result.undatedOfferCount} additional undated price{result.undatedOfferCount === 1 ? "" : "s"} excluded from ranking.
        </p>
      )}
    </div>
  );
}

function DealSummary({ deal }: { deal: DealScore }) {
  const condition = deal.evidenceCondition === "pre-owned" ? "pre-owned" : "new";
  if (deal.status === "insufficient") {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Deal score unavailable</h3>
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Insufficient evidence</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {deal.reason === "missing-ask"
            ? "Add a tracked or landed price before comparing this watch with fair asks."
            : `Add at least two dated, condition-tagged prices from distinct ${deal.preferredCondition === "new" ? "new" : "pre-owned"} retailer hostnames. The tracked headline price does not count.`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {deal.observationCount} qualifying source{deal.observationCount === 1 ? "" : "s"} · no discount percentage calculated
        </p>
      </div>
    );
  }

  const discount = deal.discountPct;
  const verdict = discount > 0.5
    ? `${Math.round(discount)}% below fair asks`
    : discount < -0.5
      ? `${Math.round(Math.abs(discount))}% above fair asks`
      : "At the fair asking median";

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Deal vs fair asks</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{verdict}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${CONFIDENCE_STYLE[deal.confidence]}`}>
            {deal.confidence} confidence
          </span>
          {deal.freshness && <FreshnessBadge tier={deal.freshness} />}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">{deal.askKind === "landed" ? "Landed ask" : "Tracked ask"}: </span>
          <strong>{formatMoney({ amount: deal.askUsd, currency: "USD" })}</strong>
        </p>
        <p>
          <span className="text-slate-500">Fair median: </span>
          <strong>{formatMoney({ amount: deal.fairMedianUsd, currency: "USD" })}</strong>
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Fair range {formatMoney({ amount: deal.fairLowUsd, currency: "USD" })}–{formatMoney({ amount: deal.fairHighUsd, currency: "USD" })}
        {` · ${deal.observationCount} independent ${condition} asks · ${ageSummary(deal.observationAgesDays)}`}
      </p>
      {deal.usedConditionFallback && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Matching {deal.preferredCondition} evidence was insufficient, so this comparison uses {condition} asks instead.
        </p>
      )}
      {(deal.freshness === "stale" || deal.freshness === "expired") && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          The fair-ask comparison includes {deal.freshness} evidence; refresh sources before treating the percentage as current.
        </p>
      )}
    </div>
  );
}

export default function MarketValuePanel({ watch }: { watch: Watch }) {
  const summaries = [marketValueSummary(watch, "new"), marketValueSummary(watch, "pre-owned")];
  const deal = dealScore(watch);
  const offer = bestOffer(watch);
  const offerTarget = bestOfferTargetStatus(watch, offer);
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Best offer, deal and market evidence</h2>
        <p className="mt-1 text-sm text-slate-500">
          The deal comparison uses independent asking prices and is distinct from rubric value based on specifications.
        </p>
      </div>
      <BestOfferSummary result={offer} target={offerTarget} />
      <div className="mt-3"><DealSummary deal={deal} /></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {summaries.map((summary) => <ConditionSummary key={summary.condition} summary={summary} />)}
      </div>
      <p className="mt-3 text-xs text-slate-400">Asking prices are signals, not completed-sale prices. Confidence rises with more recent independent sources.</p>
    </section>
  );
}
