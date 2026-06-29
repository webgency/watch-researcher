import { unstable_noStore as noStore } from "next/cache";
import { getBrands } from "@/lib/brands";
import { IS_STATIC } from "@/lib/config";
import { getWatches } from "@/lib/store";
import ValueMatrix from "@/components/ValueMatrix";

export default async function ValuePage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const [watches, brands] = await Promise.all([getWatches(), getBrands()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Value</h1>
        <p className="text-sm text-slate-500">Compare objective specs-for-price value against your calculated desire score.</p>
      </div>
      <ValueMatrix watches={watches} brands={brands} />
    </div>
  );
}
