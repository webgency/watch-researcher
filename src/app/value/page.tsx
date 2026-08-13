import { unstable_noStore as noStore } from "next/cache";
import { IS_STATIC } from "@/lib/config";
import { getWatches } from "@/lib/store";
import ValueMatrix from "@/components/ValueMatrix";

export default async function ValuePage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const watches = await getWatches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Value</h1>
        <p className="text-sm text-slate-500">Compare objective specs-for-price value against your own design rank.</p>
      </div>
      <ValueMatrix watches={watches} />
    </div>
  );
}
