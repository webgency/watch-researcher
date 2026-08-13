import Link from "next/link";
import { formatMoney } from "@/lib/format";
import {
  assignQuadrant,
  landedPriceUsd,
  PAR_SCORE,
  Quadrant,
  standingSummaries,
  StandingSummary,
  toDisplayScore,
} from "@/lib/scoring";
import { Dimension, DIMENSION_LABELS } from "@/lib/rubrics";
import { BrandCatalog, Watch } from "@/lib/types";

interface Entry {
  watch: Watch;
  summary: StandingSummary;
  quadrant: Quadrant | null;
}

type RatedEntry = Entry & { quadrant: Quadrant };

const QUADRANTS: Quadrant[] = ["buy", "aspirational", "sensible", "skip"];

const QUADRANT_META: Record<Quadrant, { label: string; shortLabel: string; color: string; fill: string }> = {
  buy: {
    label: "Buy",
    shortLabel: "Beats its band / high desire",
    color: "text-emerald-700",
    fill: "#d1fae5",
  },
  aspirational: {
    label: "Aspirational",
    shortLabel: "Trails its band / high desire",
    color: "text-amber-700",
    fill: "#fef3c7",
  },
  sensible: {
    label: "Sensible",
    shortLabel: "Beats its band / low desire",
    color: "text-sky-700",
    fill: "#e0f2fe",
  },
  skip: {
    label: "Skip",
    shortLabel: "Trails its band / low desire",
    color: "text-slate-600",
    fill: "#f1f5f9",
  },
};

// Par on both axes. The value axis is rubric-relative, so 50 is an absolute
// reference rather than a split derived from the collection.
const PAR_DISPLAY = toDisplayScore(PAR_SCORE);
const DESIRE_SPLIT = 50;

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

  // computeStanding swallows currency warnings, so surface them separately.
  const warnings: string[] = [];
  for (const watch of wishlist) {
    landedPriceUsd(watch, (message) => {
      if (!warnings.includes(message)) warnings.push(message);
    });
  }

  // Peer groups are drawn from the whole collection, not just the wishlist.
  const summaries = standingSummaries(wishlist, watches, brands);
  const entries: Entry[] = wishlist.map((watch) => {
    const summary = summaries[watch.id];
    return {
      watch,
      summary,
      quadrant:
        summary.standing.valueScore === undefined
          ? null
          : assignQuadrant(toDisplayScore(summary.standing.valueScore), summary.desirabilityScore, {
              value: PAR_DISPLAY,
              desirability: DESIRE_SPLIT,
            }),
    };
  });

  const rated = entries.filter(isRated).sort(compareEntries);
  const unrated = entries.filter((entry) => entry.quadrant === null);
  const ranks = new Map(rated.map((entry, index) => [entry.watch.id, index + 1]));
  const grouped = Object.fromEntries(
    QUADRANTS.map((quadrant) => [quadrant, rated.filter((entry) => entry.quadrant === quadrant)])
  ) as Record<Quadrant, RatedEntry[]>;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Value matrix</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rated.length} scored wishlist watch{rated.length === 1 ? "" : "es"} plotted against their price bands.
            </p>
          </div>
          <div className="text-left text-xs text-slate-500 sm:text-right">
            <p>Value par {PAR_DISPLAY}</p>
            <p>Desire score split {DESIRE_SPLIT}</p>
          </div>
        </div>

        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Value is scored against the fixed rubric for each watch&apos;s category and price band, so {PAR_DISPLAY} means
          &ldquo;exactly what that money should buy&rdquo;. Dimensions without recorded data are left unrated rather than
          filled with a mid value.
        </p>

        {warnings.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {rated.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Add prices and specs to wishlist watches to populate the matrix.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              role="img"
              aria-label="Value against desire score, split into quadrants"
              viewBox={`0 0 ${CHART.width} ${CHART.height}`}
              className="w-full min-w-[640px]"
            >
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="#ffffff" />
              {quadrantRects().map((rect) => (
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

              <line x1={xFor(PAR_DISPLAY)} x2={xFor(PAR_DISPLAY)} y1={CHART.top} y2={plotBottom} stroke="#334155" strokeWidth="2" />
              <line x1={CHART.left} x2={plotRight} y1={yFor(DESIRE_SPLIT)} y2={yFor(DESIRE_SPLIT)} stroke="#334155" strokeWidth="2" />
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

              <text x={(CHART.left + plotRight) / 2} y={CHART.height - 18} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
                Value vs price band
              </text>
              <text x="20" y={(CHART.top + plotBottom) / 2} textAnchor="middle" transform={`rotate(-90 20 ${(CHART.top + plotBottom) / 2})`} className="fill-slate-700 text-[12px] font-semibold">
                Desire score
              </text>

              {rated.map((entry) => {
                const x = xFor(toDisplayScore(entry.summary.standing.valueScore!));
                const y = yFor(entry.summary.desirabilityScore);
                return (
                  <g key={entry.watch.id}>
                    <circle cx={x} cy={y} r="7" fill="#0f172a" opacity="0.9" stroke="#ffffff" strokeWidth="2">
                      <title>
                        {`${entry.watch.brand} ${entry.watch.model}: #${ranks.get(entry.watch.id)} by value, ` +
                          `value ${formatScore(toDisplayScore(entry.summary.standing.valueScore!))}, ` +
                          `desire ${formatScore(entry.summary.desirabilityScore)} — ${entry.summary.standing.peerLabel}`}
                      </title>
                    </circle>
                    <text x={x + 10} y={y + 4} className="fill-slate-700 text-[10px]">
                      {ranks.get(entry.watch.id)}
                    </text>
                  </g>
                );
              })}
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
            <EntryList entries={grouped[quadrant]} ranks={ranks} emptyLabel="No watches in this quadrant." />
          </section>
        ))}
      </div>

      {unrated.length > 0 && (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Unscored</h3>
              <p className="text-xs text-slate-500">No tracked price, or no dimension with recorded data.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{unrated.length}</span>
          </div>
          <EntryList entries={unrated} ranks={ranks} emptyLabel="Nothing unscored." />
        </section>
      )}
    </div>
  );
}

function EntryList({
  entries,
  ranks,
  emptyLabel,
}: {
  entries: Entry[];
  ranks: Map<string, number>;
  emptyLabel: string;
}) {
  if (entries.length === 0) return <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">{emptyLabel}</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {entries.map(({ watch, summary }) => {
        const { standing } = summary;
        const rank = ranks.get(watch.id);
        return (
          <li key={watch.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{watch.brand}</p>
              <Link href={`/watch/${watch.id}`} className="font-medium hover:underline">
                {watch.model}
              </Link>
              <p className="text-xs text-slate-500">
                {formatMoney(watch.price)} · {standing.peerLabel}
                {standing.qualityPercentile !== undefined &&
                  ` · ${Math.round(standing.qualityPercentile * 100)}th pct of ${standing.peerCount}`}
              </p>
              {standing.beats.length > 0 && <p className="text-xs text-emerald-700">Beats: {labelFor(standing.beats)}</p>}
              {standing.trails.length > 0 && <p className="text-xs text-amber-700">Trails: {labelFor(standing.trails)}</p>}
              {standing.unrated.length > 0 && <p className="text-xs text-slate-400">Unrated: {labelFor(standing.unrated)}</p>}
              {standing.frictions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {standing.frictions.map((friction) => (
                    <span key={friction} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {friction}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-xs">
              <ScorePill label={rank ? `Value #${rank}` : "Value"} value={standing.valueScore} scaled />
              <ScorePill label="Quality" value={standing.qualityScore} scaled />
              <ScorePill label="Desire score" value={summary.desirabilityScore} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ScorePill({ label, value, scaled = false }: { label: string; value: number | undefined; scaled?: boolean }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
      {label} {value === undefined ? "—" : formatScore(scaled ? toDisplayScore(value) : value)}
    </span>
  );
}

function labelFor(dimensions: Dimension[]): string {
  return dimensions.map((dimension) => DIMENSION_LABELS[dimension]).join(", ");
}

function isRated(entry: Entry): entry is RatedEntry {
  return entry.quadrant !== null && entry.summary.standing.valueScore !== undefined;
}

function compareEntries(a: RatedEntry, b: RatedEntry): number {
  return (
    b.summary.standing.valueScore! - a.summary.standing.valueScore! ||
    b.summary.desirabilityScore - a.summary.desirabilityScore ||
    `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`)
  );
}

function xFor(score: number): number {
  return CHART.left + (score / 100) * plotWidth;
}

function yFor(score: number): number {
  return plotBottom - (score / 100) * plotHeight;
}

function quadrantRects() {
  const thresholdX = xFor(PAR_DISPLAY);
  const thresholdY = yFor(DESIRE_SPLIT);
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
