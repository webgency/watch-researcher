import { specChapters } from "@/lib/specs";
import type { Watch } from "@/lib/types";

export default function SpecChapters({ watch }: { watch: Watch }) {
  const chapters = specChapters(watch);

  return (
    <section aria-labelledby="specifications-heading" className="space-y-3">
      <h2 id="specifications-heading" className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">
        Specifications
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {chapters.map((chapter) => (
          <section key={chapter.id} aria-labelledby={`chapter-${chapter.id}`} className="card p-5">
            <h3 id={`chapter-${chapter.id}`} className="text-base font-semibold text-cocoa-900">
              {chapter.title}
            </h3>
            {chapter.rows.length > 0 ? (
              <dl className="mt-2 divide-y divide-cocoa-100">
                {chapter.rows.map((row) => (
                  <div key={row.key} className="flex justify-between gap-4 py-2">
                    <dt className="shrink-0 text-sm text-cocoa-500">{row.label}</dt>
                    <dd className="min-w-0 text-right text-sm font-medium tabular-nums text-cocoa-900 first-letter:uppercase">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-cocoa-500">Nothing recorded yet.</p>
            )}
            {/* Named, not dashed: a list of gaps reads as work to do, where a
                column of dashes reads as a watch that lacks the feature. */}
            {chapter.missing.length > 0 && (
              <p className="mt-3 text-xs text-cocoa-400">Not recorded: {chapter.missing.join(", ")}</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
