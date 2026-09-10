import { formatMoney } from "@/lib/format";
import { Watch } from "@/lib/types";
import { dealScore, DealScore, marketValueSummary, MarketValueSummary } from "@/lib/valuation";

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
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${CONFIDENCE_STYLE[summary.confidence]}`}>
          {summary.confidence === "insufficient" ? "Needs more data" : `${summary.confidence} confidence`}
        </span>
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
          <p className="mt-2 text-xs text-slate-400">Based on {summary.observations.length} independent, condition-matched sources</p>
        </div>
      )}
    </div>
  );
}

function ageSummary(ages: number[]): string {
  if (!ages.length) return "No dated observations";
  if (ages.length === 1) return `${ages[0]} days old`;
  return `Newest ${ages[0]}d · oldest ${ages[ages.length - 1]}d`;
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
            : `Add at least two dated prices from independent ${deal.preferredCondition === "new" ? "new" : "pre-owned"} sellers.`}
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
        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${CONFIDENCE_STYLE[deal.confidence]}`}>
          {deal.confidence} confidence
        </span>
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
    </div>
  );
}

export default function MarketValuePanel({ watch }: { watch: Watch }) {
  const summaries = [marketValueSummary(watch, "new"), marketValueSummary(watch, "pre-owned")];
  const deal = dealScore(watch);
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Deal and market evidence</h2>
        <p className="mt-1 text-sm text-slate-500">
          The deal comparison uses independent asking prices and is distinct from rubric value based on specifications.
        </p>
      </div>
      <DealSummary deal={deal} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {summaries.map((summary) => <ConditionSummary key={summary.condition} summary={summary} />)}
      </div>
      <p className="mt-3 text-xs text-slate-400">Asking prices are signals, not completed-sale prices. Confidence rises with more recent independent sources.</p>
    </section>
  );
}
