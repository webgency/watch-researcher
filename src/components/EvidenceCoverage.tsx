import type { Watch } from "@/lib/types";
import type { Standing } from "@/lib/scoring";
import { DIMENSION_LABELS } from "@/lib/rubrics";
import { evidenceBreakdown } from "@/lib/evidence-coverage";

export default function EvidenceCoverage({ watch, standing }: { watch: Watch; standing: Standing }) {
  return (
    <details className="my-2 text-xs text-cocoa-600">
      <summary className="cursor-pointer rounded py-1 font-semibold text-cocoa-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-azalea-700">
        Evidence coverage · {Math.round(standing.evidenceCoverage * 100)}%
      </summary>
      <div className="mt-2 min-w-0 space-y-3 rounded-lg border border-cocoa-200 bg-cocoa-50 p-3">
        <p>Average coverage across applicable scoring dimensions. This measures recorded evidence, not watch quality or a probability of correctness.</p>
        <ul className="space-y-3">
          {evidenceBreakdown(watch).map(row => (
            <li key={row.dimension}>
              <p className="font-semibold">{DIMENSION_LABELS[row.dimension]} · {row.applicable ? `${Math.round(row.coverage * 100)}%` : "Not applicable"}</p>
              {!row.applicable ? <p>Ships on a strap; bracelet scoring is excluded.</p> : <>
                {row.recorded.length > 0 && <p>Recorded: {row.recorded.join(", ")}.</p>}
                {row.missing.length > 0 && <p>Missing: {row.missing.join(", ")}.</p>}
                {row.gated && row.recorded.length > 0 && <p>Required inputs are missing, so this dimension remains unrated.</p>}
              </>}
            </li>
          ))}
        </ul>
        <p>Unpublished details stay unknown. Explicitly verified absence counts as evidence; omission from a page does not.</p>
      </div>
    </details>
  );
}
