import Link from "next/link";
import { formatMoney } from "@/lib/format";
import {
  assignQuadrant,
  DESIGN_LIKE_THRESHOLD,
  landedPriceUsd,
  PAR_SCORE,
  Quadrant,
  standingSummaries,
  StandingSummary,
  toDisplayScore,
} from "@/lib/scoring";
import { Dimension, DIMENSION_LABELS } from "@/lib/rubrics";
import { Watch } from "@/lib/types";

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
    shortLabel: "Good value · Like the design",
    color: "text-emerald-700",
    fill: "#d1fae5",
  },
  aspirational: {
    label: "Aspirational",
    shortLabel: "Below expected · Like the design",
    color: "text-amber-700",
    fill: "#fef3c7",
  },
  sensible: {
    label: "Sensible",
    shortLabel: "Good value · Lukewarm on it",
    color: "text-sky-700",
    fill: "#e0f2fe",
  },
  skip: {
    label: "Skip",
    shortLabel: "Below expected · Lukewarm on it",
    color: "text-slate-600",
    fill: "#f1f5f9",
  },
};

// Both axes have semantic anchors. Value splits at rubric par; design splits
// between the anchored “fine” (3) and “really like it” (4) ratings. Pairwise
// refinement can spread points inside a rating band but never cross this line.
const PAR_DISPLAY = toDisplayScore(PAR_SCORE);

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

export default function ValueMatrix({ watches }: { watches: Watch[] }) {
  const wishlist = watches.filter((watch) => watch.status === "wishlist");

  // computeStanding swallows currency warnings, so surface them separately.
  const warnings: string[] = [];
  for (const watch of wishlist) {
    landedPriceUsd(watch, (message) => {
      if (!warnings.includes(message)) warnings.push(message);
    });
  }

  // Peer groups are drawn from the whole collection, not just the wishlist.
  const summaries = standingSummaries(wishlist, watches);

  const designSplit = DESIGN_LIKE_THRESHOLD;
  const thresholds = { value: PAR_DISPLAY, design: designSplit };

  const entries: Entry[] = wishlist.map((watch) => {
    const summary = summaries[watch.id];
    return {
      watch,
      summary,
      quadrant: assignQuadrant(
        summary.standing.valueScore === undefined ? null : toDisplayScore(summary.standing.valueScore),
        summary.designScore,
        thresholds
      ),
    };
  });

  const rated = entries.filter(isRated).sort(compareEntries);
  // Two different reasons a watch is off the chart, so each list can name the
  // one thing that would put it on.
  const offChart = entries.filter((entry) => entry.quadrant === null);
  const unranked = offChart.filter((entry) => entry.summary.designScore === null);
  const unpriced = offChart.filter(
    (entry) => entry.summary.designScore !== null && entry.summary.standing.valueScore === undefined
  );
  const ranks = new Map(rated.map((entry, index) => [entry.watch.id, index + 1]));
  // Rank order, so the highest-value watches get first pick of label position.
  const points = rated.map((entry, index) => ({
    id: entry.watch.id,
    x: xFor(toDisplayScore(entry.summary.standing.valueScore!)),
    y: yFor(entry.summary.designScore!),
    text: String(index + 1),
  }));
  const rankLabels = placeRankLabels(points, quadrantHeadingBoxes(designSplit));
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
              {rated.length} scored wishlist watch{rated.length === 1 ? "" : "es"} plotted by value for the price.
            </p>
          </div>
          <div className="text-left text-xs text-slate-500 sm:text-right">
            <p>Expected value {PAR_DISPLAY}</p>
            <p>Design split: ratings 4–5</p>
          </div>
        </div>

        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {`Value is compared with fixed expectations for each category and price range, so a score of ${PAR_DISPLAY} means “what that money should buy”. Dimensions without recorded data are left unrated rather than filled with a mid value.`}
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
              aria-label="Value against design appeal, split into quadrants"
              viewBox={`0 0 ${CHART.width} ${CHART.height}`}
              className="w-full min-w-[640px]"
            >
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="#ffffff" />
              {quadrantRects(designSplit).map((rect) => {
                const heading = quadrantHeading(rect);
                return (
                  <g key={rect.quadrant}>
                    <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={QUADRANT_META[rect.quadrant].fill} opacity="0.65" />
                    <text x={heading.x} y={heading.titleY} textAnchor={heading.anchor} className="fill-slate-700 text-[13px] font-semibold">
                      {QUADRANT_META[rect.quadrant].label}
                    </text>
                  </g>
                );
              })}

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
              <line x1={CHART.left} x2={plotRight} y1={yFor(designSplit)} y2={yFor(designSplit)} stroke="#334155" strokeWidth="2" />
              <rect x={CHART.left} y={CHART.top} width={plotWidth} height={plotHeight} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

              <text x={(CHART.left + plotRight) / 2} y={CHART.height - 18} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
                Value for the price
              </text>
              <text x="20" y={(CHART.top + plotBottom) / 2} textAnchor="middle" transform={`rotate(-90 20 ${(CHART.top + plotBottom) / 2})`} className="fill-slate-700 text-[12px] font-semibold">
                Design appeal
              </text>

              {rated.map((entry) => {
                const point = points.find((candidate) => candidate.id === entry.watch.id)!;
                const label = rankLabels.get(entry.watch.id);
                return (
                  <g key={entry.watch.id}>
                    <circle cx={point.x} cy={point.y} r={DOT_RADIUS} fill="#0f172a" opacity="0.9" stroke="#ffffff" strokeWidth="2">
                      <title>
                        {`${entry.watch.brand} ${entry.watch.model}: #${ranks.get(entry.watch.id)} by value, ` +
                          `value ${formatScore(toDisplayScore(entry.summary.standing.valueScore!))}, ` +
                          `design ${formatScore(entry.summary.designScore!)} — ${entry.summary.standing.peerLabel}`}
                      </title>
                    </circle>
                    {label && (
                      <text x={label.x} y={label.y} textAnchor={label.anchor} className="fill-slate-700 text-[10px]">
                        {point.text}
                      </text>
                    )}
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

      {unranked.length > 0 && (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Not yet ranked</h3>
              <p className="text-xs text-slate-500">
                These need your design-appeal rating before they can be placed.{" "}
                <Link href="/design" className="font-medium text-blue-600 hover:underline">
                  Rank them →
                </Link>
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{unranked.length}</span>
          </div>
          <EntryList entries={unranked} ranks={ranks} emptyLabel="Everything is ranked." />
        </section>
      )}

      {unpriced.length > 0 && (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Unscored value</h3>
              <p className="text-xs text-slate-500">Ranked, but with no tracked price or no dimension with recorded data.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{unpriced.length}</span>
          </div>
          <EntryList entries={unpriced} ranks={ranks} emptyLabel="Nothing unscored." />
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
              {standing.beats.length > 0 && <p className="text-xs text-emerald-700">Above expectations: {labelFor(standing.beats)}</p>}
              {standing.trails.length > 0 && <p className="text-xs text-amber-700">Below expectations: {labelFor(standing.trails)}</p>}
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
              <span
                className={`rounded-full px-2 py-1 font-medium ${
                  standing.confidence === "low"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
                title={`${standing.confidence} confidence from recorded scoring inputs`}
              >
                Evidence {Math.round(standing.evidenceCoverage * 100)}%
              </span>
              <ScorePill label="Design" value={summary.designScore ?? undefined} />
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
    (b.summary.designScore ?? 0) - (a.summary.designScore ?? 0) ||
    `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`)
  );
}

const DOT_RADIUS = 7;
// Measured from the rendered 10px labels: a digit is 6.37 wide and 11.28 tall.
// Rounded up so a collision box is never smaller than the glyphs it stands for,
// which leaves roughly a pixel of breathing room between neighbours.
const LABEL_HEIGHT = 12;
const LABEL_CHAR_WIDTH = 7;

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Anchor = "start" | "middle" | "end";

// Tried in order, so a label sits to the right of its dot when there is room.
const LABEL_POSITIONS: Array<{ dx: number; dy: number; anchor: Anchor }> = [
  { dx: DOT_RADIUS + 3, dy: 4, anchor: "start" },
  { dx: -(DOT_RADIUS + 3), dy: 4, anchor: "end" },
  { dx: 0, dy: -(DOT_RADIUS + 4), anchor: "middle" },
  { dx: 0, dy: DOT_RADIUS + LABEL_HEIGHT + 1, anchor: "middle" },
];

function intersects(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/**
 * Greedy label placement. Points arrive in rank order, so the best-ranked
 * watches get first choice of position; every dot and every already-placed
 * label is an obstacle, so a number never lands on another watch's point.
 * A point with no free position gets no label — it keeps its dot and tooltip,
 * and its rank is still listed in the quadrant tables below the chart.
 */
function placeRankLabels(
  points: Array<{ id: string; x: number; y: number; text: string }>,
  reserved: Box[]
): Map<string, { x: number; y: number; anchor: Anchor }> {
  const obstacles: Box[] = [
    ...reserved,
    ...points.map((point) => ({
      x1: point.x - DOT_RADIUS,
      y1: point.y - DOT_RADIUS,
      x2: point.x + DOT_RADIUS,
      y2: point.y + DOT_RADIUS,
    })),
  ];

  const placed = new Map<string, { x: number; y: number; anchor: Anchor }>();
  for (const point of points) {
    for (const position of LABEL_POSITIONS) {
      const width = point.text.length * LABEL_CHAR_WIDTH;
      const x = point.x + position.dx;
      const y = point.y + position.dy;
      const left = position.anchor === "start" ? x : position.anchor === "end" ? x - width : x - width / 2;
      const box = { x1: left, y1: y - LABEL_HEIGHT, x2: left + width, y2: y };
      const insidePlot =
        box.x1 >= CHART.left && box.x2 <= plotRight && box.y1 >= CHART.top && box.y2 <= plotBottom;
      if (!insidePlot || obstacles.some((obstacle) => intersects(box, obstacle))) continue;
      obstacles.push(box);
      placed.set(point.id, { x, y, anchor: position.anchor });
      break;
    }
  }
  return placed;
}

function xFor(score: number): number {
  return CHART.left + (score / 100) * plotWidth;
}

function yFor(score: number): number {
  return plotBottom - (score / 100) * plotHeight;
}

function quadrantRects(designSplit: number) {
  const thresholdX = xFor(PAR_DISPLAY);
  const thresholdY = yFor(designSplit);
  // Headings sit in each quadrant's outer corner, away from the centre where
  // the points cluster. Anchoring all four at their top-left put the two lower
  // headings directly under the data.
  return [
    { quadrant: "aspirational" as const, x: CHART.left, y: CHART.top, width: thresholdX - CHART.left, height: thresholdY - CHART.top, right: false, bottom: false },
    { quadrant: "buy" as const, x: thresholdX, y: CHART.top, width: plotRight - thresholdX, height: thresholdY - CHART.top, right: true, bottom: false },
    { quadrant: "skip" as const, x: CHART.left, y: thresholdY, width: thresholdX - CHART.left, height: plotBottom - thresholdY, right: false, bottom: true },
    { quadrant: "sensible" as const, x: thresholdX, y: thresholdY, width: plotRight - thresholdX, height: plotBottom - thresholdY, right: true, bottom: true },
  ];
}

/** Where a quadrant's two heading lines sit, given its outer corner. */
function quadrantHeading(rect: ReturnType<typeof quadrantRects>[number]) {
  const x = rect.right ? rect.x + rect.width - 14 : rect.x + 14;
  const titleY = rect.bottom ? rect.y + rect.height - 32 : rect.y + 24;
  return { x, titleY, subY: titleY + 18, anchor: (rect.right ? "end" : "start") as Anchor };
}

/** Heading boxes, reserved so rank labels never land on them. */
function quadrantHeadingBoxes(designSplit: number): Box[] {
  return quadrantRects(designSplit).map((rect) => {
    const { x, titleY, anchor } = quadrantHeading(rect);
    const width = QUADRANT_META[rect.quadrant].label.length * 7;
    return {
      x1: anchor === "end" ? x - width : x,
      y1: titleY - 16,
      x2: anchor === "end" ? x : x + width,
      y2: titleY + 4,
    };
  });
}

function formatScore(value: number): string {
  return String(Math.round(value));
}
