import { Watch } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { lowestSnapshot, priceMovement, targetStatus } from "@/lib/price-history";

function pct(value: number): string {
  return `${Math.abs(value * 100).toFixed(1)}%`;
}

/**
 * Price history and target status. Renders nothing when there is neither a
 * target nor a recorded series — a watch added before either existed should
 * show no empty scaffolding.
 */
export default function PriceHistoryPanel({ watch }: { watch: Watch }) {
  const history = watch.priceHistory ?? [];
  const target = targetStatus(watch);
  const movement = priceMovement(history);
  const lowest = lowestSnapshot(history);

  if (!target && history.length === 0) return null;

  // A single entry is the starting point, not a low to brag about.
  const showLowest = lowest && history.length > 1 && lowest !== history[history.length - 1];

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Price</h2>

      {target && (
        <div
          className={`mb-4 rounded-lg border p-3 ${
            target.met ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`text-sm font-semibold ${target.met ? "text-emerald-700" : "text-slate-700"}`}>
              {target.met ? "At or below your target" : "Above your target"}
            </span>
            <span className="text-sm text-slate-500">Target {formatMoney(target.target)}</span>
          </div>
          {!target.met && (
            <p className="mt-1 text-xs text-slate-500">
              ${Math.round(target.gapUsd).toLocaleString()} over ({pct(target.gapPct)} above target)
            </p>
          )}
        </div>
      )}

      {movement && (
        <p className="mb-3 text-sm">
          <span
            className={`font-semibold ${
              movement.deltaUsd < 0 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {movement.deltaUsd < 0 ? "▼" : "▲"} {pct(movement.deltaPct)}
          </span>{" "}
          <span className="text-slate-500">
            since {formatDate(movement.previous.date)} ({formatMoney(movement.previous.price)} →{" "}
            {formatMoney(movement.latest.price)})
          </span>
        </p>
      )}

      {history.length > 0 ? (
        <>
          <ol className="space-y-1.5">
            {[...history].reverse().map((snapshot, i) => (
              <li
                key={`${snapshot.date}-${i}`}
                className="flex items-center justify-between gap-4 border-b border-slate-100 pb-1.5 text-sm last:border-0"
              >
                <span className="text-slate-500">{formatDate(snapshot.date)}</span>
                <span className="flex items-center gap-2">
                  {snapshot.source && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{snapshot.source}</span>
                  )}
                  <span className="font-medium">{formatMoney(snapshot.price)}</span>
                </span>
              </li>
            ))}
          </ol>
          {showLowest && (
            <p className="mt-3 text-xs text-slate-400">
              Lowest recorded: {formatMoney(lowest.price)} on {formatDate(lowest.date)}
            </p>
          )}
          {history.length === 1 && (
            <p className="mt-3 text-xs text-slate-400">
              One observation so far — run the enrich script with <code>--refresh</code> to track moves.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">No price history recorded yet.</p>
      )}
    </section>
  );
}
