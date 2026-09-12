import { unstable_noStore as noStore } from "next/cache";
import { IS_STATIC } from "@/lib/config";
import { getWatches } from "@/lib/store";
import { standingSummaries } from "@/lib/scoring";
import ValueList from "@/components/ValueList";

export default async function ValuePage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const watches = await getWatches();
  const eligible = watches.filter((watch) => watch.status !== "sold");
  const summaries = standingSummaries(eligible, watches);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Value</h1>
        <p className="text-sm text-cocoa-500">
          Rank what each watch delivers for its price. Deal evidence and design are shown separately and never alter rubric value.
        </p>
      </div>
      <ValueList watches={eligible} summaries={summaries} nowIso={new Date().toISOString()} />
    </div>
  );
}
