import Link from "next/link";
import { formatMoney } from "@/lib/format";
import {
  compareValueScores,
  computeWatchScores,
  DataCompleteness,
  MIN_MEDIAN_THRESHOLD_COUNT,
  Quadrant,
  valueRankings,
  WatchScore,
} from "@/lib/scoring";
import { BrandCatalog, Watch } from "@/lib/types";

type RatedWatchScore = WatchScore & { valueScore: number; quadrant: Quadrant };

const QUADRANTS: Quadrant[] = ["buy", "aspirational", "sensible", "skip"];

const QUADRANT_META: Record<Quadrant, { label: string; shortLabel: string; color: string; fill: string }> = {
  buy: {
    label: "Buy",
    shortLabel: "High value / high desire",
    color: "text-emerald-700",
    fill: "#d1fae5",
  },
  aspirational: {
    label: "Aspirational",
    shortLabel: "Low value / high desire",
    color: "text-amber-700",
    fill: "#fef3c7",
  },
  sensible: {
    label: "Sensible",
    shortLabel: "High value / low desire",
    color: "text-sky-700",
    fill: "#e0f2fe",
  },
  skip: {
    label: "Skip",
    shortLabel: "Low value / low desire",
    color: "text-slate-600",
    fill: "#f1f5f9",
  },
};

const CHART = {
  width: 760,
  height: 500,
  left: 72,
  right: 32,
  top: 32,
  bottom: 64,
};

const plotWidth = CHART.width - CHART.left - CHART.right;
const plotHeight = CHART.height - CHART.top - CHART.bottom;
const plotRight = CHART.left + plotWidth;
const plotBottom = CHART.top + plotHeight;

export default function ValueMatrix({ watches, brands }: { watches: Watch[]; brands: BrandCatalog }) {
  const wishlist = watches.filter((watch) => watch.status === "wishlist");
  const warnings: string[] = [];
  const { scores, thresholds, thresholdMethod } = computeWatchScores(wishlist, brands, (message) => {
    if (!warnings.includes(message)) warnings.push(message);
  });
  const valueRanks = valueRankings(scores);
  const rated = scores.filter(isRated).sort(compareValueScores);
  const unrated = scores.filter((score) => score.valueScore === null);
  const grouped = Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant, rated.filter((score) => score.quadrant === quadrant)])) as Record<
    Quadrant,
    RatedWatchScore[]
  >;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Value matrix</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rated.length} priced wishlist watch{rated.length === 1 ? "" : "es"} plotted.
            </p>
          </div>
          <div className="text-left text-xs text-slate-500 sm:text-right">
            <p>Value split {formatScore(thresholds.value)}</p>
            <p>Desire score split {formatScore(thresholds.desirability)}</p>
          </div>
        </div>

        {thresholdMethod === "fixed" && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Fewer than {MIN_MEDIAN_THRESHOLD_COUNT} priced watches are rated, so this view uses a fixed 50/50 split.
          </p>
        )}

        {warnings.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {rated.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Add tracked prices to wishlist watches to populate the matrix.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg role="img" aria-label="Value and desire score quadrant chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full min-w-[640px]">
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="#ffffff" />
              {quadrantRects(thresholds.value, thresholds.desirability).map((rect) => (
                <g key={rect.quadrant}>
                  <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={QUADRANT_META[rect.quadrant].fill} opacity="0.65" />
                  <text x={rect.x + 14} y={rect.y + 24} className="fill-slate-700 text-[13px] font-semibold">
                    {QUADRANT_META[rect.quadrant].label}
                  </text>
                  <text x={rect.x + 14} y={rect.y + 42} className="fill-slate-500 text-[11px]">
                    {QUADRANT_META[rect.quadrant].shortLabel}
                  </text>
                </g>
              ))}

              {[0, 25, 50, 75, 100].map((tick) => (
                <g key={tick}>
                  <line x1={xFor(tick)} x2={xFor(tick)} y1={CHART.top} y2={plotBottom} stroke="#cbd5e1" strokeDasharray="3 4" strokeWidth="1" />
                  <line x1={CHART.left} x2={plotRight} y1={yFor(tick)} y2={yFor(tick)} stroke="#cbd5e1" strokeDasharray="3 4" strokeWidth="1" />
                  <text x={xFor(tick)} y={plotBottom + 20} textAnchor="middle" className="fill-slate-500 text-[11px]">
                    {tick}
                  </text>
                  <text x={CHART.left - 12} y={yFor(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                    {tick}
                  </text>
                </g>
              ))}

              <line x1={xFor(thresholds.value)} x2={xFor(thresholds.value)} y1={CHART.top} y2={plotBottom} stroke="#334155" strokeWidth="2" />
              <line x1={CHART.left} x2={plotRight} y1={yFor(thresholds.desirability)} y2={yFor(thresholds.desirability)} stroke="#334155" strokeWidth="2" />
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

              <text x={(CHART.left + plotRight) / 2} y={CHART.height - 18} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
                Value
              </text>
              <text x="20" y={(CHART.top + plotBottom) / 2} textAnchor="middle" transform={`rotate(-90 20 ${(CHART.top + plotBottom) / 2})`} className="fill-slate-700 text-[12px] font-semibold">
                Desire score
              </text>

              {rated.map((score) => (
                <g key={score.watch.id}>
                  <circle
                    cx={xFor(score.valueScore)}
                    cy={yFor(score.desirabilityScore)}
                    r="7"
                    fill="#0f172a"
                    opacity="0.9"
                    stroke="#ffffff"
                    strokeWidth="2"
                  >
                    <title>{`${score.watch.brand} ${score.watch.model}: value rank #${valueRanks.get(score.watch.id)}, value ${formatScore(score.valueScore)}, desire score ${formatScore(score.desirabilityScore)}`}</title>
                  </circle>
                  <text x={xFor(score.valueScore) + 10} y={yFor(score.desirabilityScore) + 4} className="fill-slate-700 text-[10px]">
                    {valueRanks.get(score.watch.id)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUADRANTS.map((quadrant) => (
          <section key={quadrant} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className={`text-sm font-semibold uppercase tracking-wide ${QUADRANT_META[quadrant].color}`}>
                  {QUADRANT_META[quadrant].label}
                </h3>
                <p className="text-xs text-slate-500">{QUADRANT_META[quadrant].shortLabel}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{grouped[quadrant].length}</span>
            </div>
            <WatchScoreList scores={grouped[quadrant]} valueRanks={valueRanks} />
          </section>
        ))}
      </div>

      {unrated.length > 0 && (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Unrated value</h3>
              <p className="text-xs text-slate-500">Wishlist watches without a tracked price.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{unrated.length}</span>
          </div>
          <WatchScoreList scores={unrated} valueRanks={valueRanks} />
        </section>
      )}
    </div>
  );
}

function WatchScoreList({ scores, valueRanks }: { scores: WatchScore[]; valueRanks: Map<string, number> }) {
  if (scores.length === 0) return <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">No watches in this quadrant.</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {scores.map((score) => (
        <li key={score.watch.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{score.watch.brand}</p>
            <Link href={`/watch/${score.watch.id}`} className="font-medium hover:underline">
              {score.watch.model}
            </Link>
            <p className="text-xs text-slate-500">{formatMoney(score.watch.price)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ScorePill label={valueRanks.get(score.watch.id) ? `Value #${valueRanks.get(score.watch.id)}` : "Value"} value={score.valueScore} />
            <ScorePill label="Desire score" value={score.desirabilityScore} />
            <DataCompletenessBadge completeness={score.dataCompleteness} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
      {label} {value === null ? "—" : formatScore(value)}
    </span>
  );
}

function DataCompletenessBadge({ completeness }: { completeness: DataCompleteness }) {
  const complete = completeness.present === completeness.total;
  return (
    <span
      title={completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "All scored specs present"}
      className={`rounded-full px-2 py-1 font-medium ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
    >
      Data {completeness.present}/{completeness.total}
    </span>
  );
}

function isRated(score: WatchScore): score is RatedWatchScore {
  return score.valueScore !== null && score.quadrant !== null;
}

function xFor(score: number): number {
  return CHART.left + (score / 100) * plotWidth;
}

function yFor(score: number): number {
  return plotBottom - (score / 100) * plotHeight;
}

function quadrantRects(valueThreshold: number, desirabilityThreshold: number) {
  const thresholdX = xFor(valueThreshold);
  const thresholdY = yFor(desirabilityThreshold);
  return [
    { quadrant: "aspirational" as const, x: CHART.left, y: CHART.top, width: thresholdX - CHART.left, height: thresholdY - CHART.top },
    { quadrant: "buy" as const, x: thresholdX, y: CHART.top, width: plotRight - thresholdX, height: thresholdY - CHART.top },
    { quadrant: "skip" as const, x: CHART.left, y: thresholdY, width: thresholdX - CHART.left, height: plotBottom - thresholdY },
    { quadrant: "sensible" as const, x: thresholdX, y: thresholdY, width: plotRight - thresholdX, height: plotBottom - thresholdY },
  ];
}

function formatScore(value: number): string {
  return String(Math.round(value));
}
