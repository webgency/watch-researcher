import { formatMoney } from "@/lib/format";
import { Watch } from "@/lib/types";
import { marketValueSummary, MarketValueSummary } from "@/lib/valuation";

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

export default function MarketValuePanel({ watch }: { watch: Watch }) {
  const summaries = [marketValueSummary(watch, "new"), marketValueSummary(watch, "pre-owned")];
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Market price evidence</h2>
        <p className="mt-1 text-sm text-slate-500">
          Asking prices from independent sellers, kept separate by condition. This is distinct from specification value.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((summary) => <ConditionSummary key={summary.condition} summary={summary} />)}
      </div>
      <p className="mt-3 text-xs text-slate-400">Asking prices are signals, not completed-sale prices. Confidence rises with more recent independent sources.</p>
    </section>
  );
}
