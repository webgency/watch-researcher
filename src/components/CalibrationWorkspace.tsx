"use client";

import { useMemo, useState } from "react";
import { CalibrationJudgment, ScoringBenchmark } from "@/lib/calibration-store";
import { Watch } from "@/lib/types";

interface Candidate {
  watch: Watch;
  currentValue: number;
  proposedValue: number;
  currentWearability?: number;
  proposedWearability?: number;
  change: number;
}

const OPTIONS: Array<{ value: CalibrationJudgment; label: string }> = [
  { value: "too-low", label: "Too low" },
  { value: "fair", label: "Fair" },
  { value: "too-high", label: "Too high" },
];

function JudgmentButtons({
  value,
  onChange,
}: {
  value?: CalibrationJudgment;
  onChange: (value: CalibrationJudgment) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
            value === option.value
              ? "border-cocoa-900 bg-cocoa-900 text-white"
              : "border-cocoa-200 bg-white text-cocoa-600 hover:bg-cocoa-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function CalibrationWorkspace({
  candidates,
  initialBenchmarks,
}: {
  candidates: Candidate[];
  initialBenchmarks: ScoringBenchmark[];
}) {
  const [benchmarks, setBenchmarks] = useState(initialBenchmarks);
  const [status, setStatus] = useState<string | null>(null);
  const byId = useMemo(() => new Map(benchmarks.map((row) => [row.watchId, row])), [benchmarks]);
  const completed = candidates.filter((candidate) => {
    const row = byId.get(candidate.watch.id);
    return row?.wearability && row.value;
  }).length;

  function update(watchId: string, patch: Partial<ScoringBenchmark>) {
    setBenchmarks((current) => {
      const existing = current.find((row) => row.watchId === watchId);
      const next: ScoringBenchmark = {
        watchId,
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      return existing ? current.map((row) => row.watchId === watchId ? next : row) : [...current, next];
    });
    setStatus(null);
  }

  async function save() {
    setStatus("Saving…");
    try {
      const response = await fetch("/api/scoring-benchmarks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(benchmarks),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save benchmarks");
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save benchmarks");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scoring calibration</h1>
          <p className="mt-1 max-w-3xl text-sm text-cocoa-500">
            Judge the proposed score on its own merits. “Fair” means the proposed number matches your practical impression—not merely that it improved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-cocoa-500">{completed} of {candidates.length} complete</span>
          <button type="button" className="btn-primary" onClick={save}>Save benchmarks</button>
          {status && <span className="text-sm text-cocoa-500" role="status">{status}</span>}
        </div>
      </div>

      <div className="space-y-4">
        {candidates.map((candidate) => {
          const benchmark = byId.get(candidate.watch.id);
          return (
            <article key={candidate.watch.id} className="card grid gap-4 p-4 md:grid-cols-[120px_1fr_260px]">
              <div className="h-28 overflow-hidden rounded-lg bg-cocoa-100">
                {candidate.watch.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-full w-full object-cover" src={candidate.watch.imageUrl} alt="" />
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{candidate.watch.brand}</p>
                <h2 className="font-semibold text-cocoa-900">{candidate.watch.model}</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-cocoa-50 p-2">
                    <p className="text-xs text-cocoa-500">Value</p>
                    <p><span className="text-cocoa-400">Current {candidate.currentValue}</span> → <strong>{candidate.proposedValue}</strong></p>
                  </div>
                  <div className="rounded bg-cocoa-50 p-2">
                  <p className="text-xs text-cocoa-500">Case profile</p>
                    <p><span className="text-cocoa-400">Current {candidate.currentWearability ?? "—"}</span> → <strong>{candidate.proposedWearability ?? "—"}</strong></p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs font-semibold text-cocoa-600">
                  <p>Proposed value score</p>
                  <JudgmentButtons value={benchmark?.value} onChange={(value) => update(candidate.watch.id, { value })} />
                </div>
                <div className="text-xs font-semibold text-cocoa-600">
                  <p>Proposed case-profile score</p>
                  <JudgmentButtons value={benchmark?.wearability} onChange={(wearability) => update(candidate.watch.id, { wearability })} />
                </div>
                <textarea
                  className="input min-h-16 text-xs"
                  value={benchmark?.notes ?? ""}
                  onChange={(event) => update(candidate.watch.id, { notes: event.target.value })}
                  placeholder="Optional notes"
                  aria-label={`Notes for ${candidate.watch.brand} ${candidate.watch.model}`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
