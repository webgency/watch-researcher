/**
 * Read-only comparison of production scoring with proposed calibration rules.
 * It never writes data/watches.json. Run with: npm run calibrate:scoring
 */
import watchesData from "../data/watches.json";
import benchmarksData from "../data/scoring-benchmarks.json";
import { ScoringBenchmark } from "../src/lib/calibration-store";
import { calibrationScore } from "../src/lib/scoring-calibration";
import { computeStanding } from "../src/lib/scoring";
import { Watch } from "../src/lib/types";

const watches = watchesData as Watch[];
const benchmarks = benchmarksData as ScoringBenchmark[];
const rows = watches.flatMap((watch) => {
  const current = computeStanding(watch, watches);
  const proposed = calibrationScore(watch);
  if (current.valueScore === undefined || proposed.valueScore === undefined) return [];
  return [{
    watch: `${watch.brand} ${watch.model}`,
    currentValue: Math.round(current.valueScore * 100),
    proposedValue: Math.round(proposed.valueScore * 100),
    change: Math.round((proposed.valueScore - current.valueScore) * 100),
    currentQuality: Math.round((current.qualityScore ?? 0) * 100),
    proposedQuality: Math.round((proposed.qualityScore ?? 0) * 100),
    currentWearability: current.dimensions.wearability ? Math.round(current.dimensions.wearability.raw * 100) : "—",
    proposedWearability: proposed.wearabilityScore === undefined ? "—" : Math.round(proposed.wearabilityScore * 100),
  }];
});

const largestIncreases = [...rows].sort((a, b) => b.change - a.change).slice(0, 10);
const largestDecreases = [...rows].sort((a, b) => a.change - b.change).slice(0, 10);
const spinnaker = rows.filter((row) => /Spinnaker Croft Mid-Size/i.test(row.watch));
const averageChange = rows.reduce((sum, row) => sum + row.change, 0) / rows.length;
const distribution = {
  compared: rows.length,
  averageChange: Number(averageChange.toFixed(1)),
  increased: rows.filter((row) => row.change > 0).length,
  unchanged: rows.filter((row) => row.change === 0).length,
  decreased: rows.filter((row) => row.change < 0).length,
};

console.log("\nScoring calibration — production data is unchanged\n");
console.log("Collection-wide bias check:");
console.table([distribution]);
console.log("Largest proposed increases:");
console.table(largestIncreases);
console.log("Largest proposed decreases:");
console.table(largestDecreases);
console.log("Spinnaker focus:");
console.table(spinnaker);
if (benchmarks.length) {
  const judgments = benchmarks.reduce((summary, benchmark) => {
    if (benchmark.value) summary[`value ${benchmark.value}`] = (summary[`value ${benchmark.value}`] ?? 0) + 1;
    if (benchmark.wearability) summary[`wearability ${benchmark.wearability}`] = (summary[`wearability ${benchmark.wearability}`] ?? 0) + 1;
    return summary;
  }, {} as Record<string, number>);
  console.log("Saved human judgments:");
  console.table(judgments);
} else {
  console.log("No human judgments saved yet. Complete /calibration before adopting the proposal.");
}
console.log(`Compared ${rows.length} scored watches. Positive change means the proposal scores higher.`);
