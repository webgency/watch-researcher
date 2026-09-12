import CalibrationWorkspace from "@/components/CalibrationWorkspace";
import { getBenchmarks } from "@/lib/calibration-store";
import { calibrationScore } from "@/lib/scoring-calibration";
import { computeStanding, deriveCategory } from "@/lib/scoring";
import { getWatches } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  const [watches, benchmarks] = await Promise.all([getWatches(), getBenchmarks()]);
  const scored = watches.flatMap((watch) => {
    const current = computeStanding(watch, watches);
    const proposed = calibrationScore(watch);
    if (current.valueScore === undefined || proposed.valueScore === undefined) return [];
    return [{
      watch,
      currentValue: Math.round(current.valueScore * 100),
      proposedValue: Math.round(proposed.valueScore * 100),
      currentWearability: current.dimensions.wearability ? Math.round(current.dimensions.wearability.raw * 100) : undefined,
      proposedWearability: proposed.wearabilityScore === undefined ? undefined : Math.round(proposed.wearabilityScore * 100),
      change: Math.round((proposed.valueScore - current.valueScore) * 100),
      category: deriveCategory(watch),
    }];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  // Keep the review short but representative instead of letting the category
  // with the largest formula effect occupy the entire benchmark set.
  const representative = ["diver", "chronograph", "gmt", "dress"].flatMap((category) =>
    scored.filter((entry) => entry.category === category).slice(0, 3)
  );
  const spinnaker = scored.find((entry) => /Spinnaker Croft Mid-Size/i.test(`${entry.watch.brand} ${entry.watch.model}`));
  const candidates = spinnaker && !representative.some((entry) => entry.watch.id === spinnaker.watch.id)
    ? [...representative, spinnaker]
    : representative;

  return <CalibrationWorkspace candidates={candidates} initialBenchmarks={benchmarks} />;
}
