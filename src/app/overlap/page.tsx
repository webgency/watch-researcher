import { unstable_noStore as noStore } from "next/cache";
import { IS_STATIC } from "@/lib/config";
import { getWatches } from "@/lib/store";
import { findOverlaps, PRICE_RATIO_LIMIT, SIZE_TOLERANCE_MM } from "@/lib/overlap";
import OverlapGroups from "@/components/OverlapGroups";

export default async function OverlapPage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const watches = await getWatches();

  // findOverlaps normalizes prices to USD, which can warn about an unknown
  // currency. Surface those rather than letting them vanish, as ValueMatrix does.
  const warnings: string[] = [];
  const report = findOverlaps(watches, (message) => {
    if (!warnings.includes(message)) warnings.push(message);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overlap</h1>
        <p className="text-sm text-slate-500">
          Entries that would be the same purchase: same category, within {SIZE_TOLERANCE_MM}mm of case diameter, and
          within {PRICE_RATIO_LIMIT}x on the all-in price. Each group is one decision, not several.
        </p>
      </div>
      <OverlapGroups report={report} warnings={warnings} />
    </div>
  );
}
