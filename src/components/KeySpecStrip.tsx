import { keySpecs } from "@/lib/specs";
import type { WatchSpecs } from "@/lib/types";

/**
 * The handful of numbers people check first. Missing specs are left out, not
 * dashed: the strip is a summary, and the chapters below name what is not
 * recorded. With nothing recorded the strip disappears rather than sit empty.
 */
export default function KeySpecStrip({ specs }: { specs: WatchSpecs }) {
  const items = keySpecs(specs);
  if (items.length === 0) return null;

  return (
    <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
      {items.map((item) => (
        // Caliber names run long ("Co-Axial Master Chronometer 8800"), so it
        // gets the width the short measurements do not need.
        <div key={item.key} className={`min-w-0 ${item.key === "caliber" ? "col-span-2" : ""}`}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">{item.label}</dt>
          <dd className="mt-1 text-lg font-semibold leading-snug tabular-nums text-cocoa-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
