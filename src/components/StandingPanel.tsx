import {
  DIMENSION_BLURBS,
  DIMENSION_LABELS,
  RUBRIC_TOLERANCE,
  Standing,
  unratedReason,
} from "@/lib/scoring";
import { DIMENSIONS, type Dimension } from "@/lib/rubrics";
import type { Watch } from "@/lib/types";

type Verdict = "beats" | "par" | "trails";

// Status encoding, not series identity. Every row also carries the verdict in
// words, so the colour never has to be read on its own — which is what lets the
// green/amber pair stand up under protanopia.
const VERDICT: Record<Verdict, { label: string; fill: string; track: string; text: string }> = {
  beats: {
    label: "Beats par",
    fill: "bg-emerald-600",
    track: "bg-emerald-100",
    text: "text-emerald-700",
  },
  par: {
    label: "At par",
    fill: "bg-slate-500",
    track: "bg-slate-200",
    text: "text-slate-600",
  },
  trails: {
    label: "Trails",
    fill: "bg-amber-600",
    track: "bg-amber-100",
    text: "text-amber-700",
  },
};

/** 0-1 as a 0-100 integer. */
function pct(value: number): number {
  return Math.round(value * 100);
}

function verdictFor(raw: number, reference?: number): Verdict {
  if (reference === undefined) return "par";
  if (raw > reference + RUBRIC_TOLERANCE) return "beats";
  if (raw < reference - RUBRIC_TOLERANCE) return "trails";
  return "par";
}

/**
 * A single dimension as a meter: fill to the score, a tick at the band's par.
 * The reader's question is "is this above or below what the money should buy",
 * so par has to be visible on the track rather than implied by the colour.
 */
function DimensionMeter({
  dimension,
  raw,
  reference,
}: {
  dimension: Dimension;
  raw: number;
  reference?: number;
}) {
  const verdict = verdictFor(raw, reference);
  const style = VERDICT[verdict];

  return (
    <div className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 py-2 sm:grid-cols-[11rem_1fr_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700" title={DIMENSION_BLURBS[dimension]}>
          {DIMENSION_LABELS[dimension]}
        </p>
      </div>

      <div
        className={`relative h-2.5 overflow-hidden rounded-full ${style.track}`}
        role="img"
        aria-label={
          reference === undefined
            ? `${DIMENSION_LABELS[dimension]}: ${pct(raw)} of 100, no band reference`
            : `${DIMENSION_LABELS[dimension]}: ${pct(raw)} of 100 against par ${pct(reference)} — ${style.label}`
        }
      >
        <div
          className={`h-full rounded-full ${style.fill}`}
          style={{ width: `${Math.max(pct(raw), 1.5)}%` }}
        />
        {reference !== undefined && (
          // Par marker. Sits above the fill so it stays visible when the fill
          // runs past it.
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-slate-900/70"
            style={{ left: `${pct(reference)}%` }}
          />
        )}
      </div>

      <div className="flex items-baseline justify-end gap-2 whitespace-nowrap">
        <span className="text-sm font-semibold tabular-nums text-slate-800">{pct(raw)}</span>
        <span className={`w-20 text-right text-xs font-medium ${style.text}`}>{style.label}</span>
      </div>
    </div>
  );
}

function UnratedRow({ dimension, watch }: { dimension: Dimension; watch: Watch }) {
  return (
    <div className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 py-2 sm:grid-cols-[11rem_1fr_auto]">
      <p className="truncate text-sm font-medium text-slate-400" title={DIMENSION_BLURBS[dimension]}>
        {DIMENSION_LABELS[dimension]}
      </p>
      <div className="h-2.5 rounded-full bg-[repeating-linear-gradient(45deg,#f1f5f9_0_6px,#e2e8f0_6px_12px)]" />
      <span className="w-20 text-right text-xs font-medium text-slate-400">Unrated</span>
      <p className="col-span-3 -mt-1 text-xs text-slate-400">{unratedReason(watch, dimension)}</p>
    </div>
  );
}

function ScoreTile({ label, value, caption }: { label: string; value?: number; caption: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">
        {value === undefined ? "—" : pct(value)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

export default function StandingPanel({ watch, standing }: { watch: Watch; standing: Standing }) {
  const ratedCount = DIMENSIONS.length - standing.unrated.length;
  const rated = DIMENSIONS.filter((d) => standing.dimensions[d]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Standing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Scored against the rubric for {standing.peerLabel}.
          </p>
        </div>
        <p className="text-xs text-slate-400 sm:text-right">
          Rated on {ratedCount} of {DIMENSIONS.length} dimensions
          {standing.peerCount > 1 && <> · {standing.peerCount} in band</>}
        </p>
      </div>

      {rated.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Nothing recorded for this watch can be scored yet.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <ScoreTile
              label="Quality"
              value={standing.qualityScore}
              caption={`Across ${ratedCount} rated dimension${ratedCount === 1 ? "" : "s"}`}
            />
            <ScoreTile
              label="Value"
              value={standing.valueScore}
              caption={standing.valueScore === undefined ? "Needs a price" : "Quality for the money"}
            />
          </div>

          {ratedCount <= 2 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Only {ratedCount} dimension{ratedCount === 1 ? " is" : "s are"} rated, so these
              composites rest on thin evidence.
            </p>
          )}

          <div className="divide-y divide-slate-100">
            {rated.map((dimension) => (
              <DimensionMeter
                key={dimension}
                dimension={dimension}
                raw={standing.dimensions[dimension]!.raw}
                reference={standing.dimensions[dimension]!.reference}
              />
            ))}
            {standing.unrated.map((dimension) => (
              <UnratedRow key={dimension} dimension={dimension} watch={watch} />
            ))}
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-3 w-0.5 bg-slate-900/70" />
            Par for {standing.peerLabel}
          </p>

          {standing.qualityPercentile !== undefined && (
            <p className="mt-2 text-xs text-slate-500">
              Ahead of {pct(standing.qualityPercentile)}% of the {standing.peerCount} watches in
              this band.
            </p>
          )}

        </>
      )}
    </section>
  );
}
