import { unstable_noStore as noStore } from "next/cache";
import { getBrands } from "@/lib/brands";
import { getWatches } from "@/lib/store";
import { standingSummaries } from "@/lib/scoring";
import { IS_STATIC } from "@/lib/config";
import CollectionView from "@/components/CollectionView";

export default async function HomePage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const [watches, brands] = await Promise.all([getWatches(), getBrands()]);
  // Standings are objective, so every watch gets one — owned pieces included —
  // and the whole collection acts as the peer pool.
  const summaries = standingSummaries(watches, watches, brands);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your collection</h1>
        <p className="text-sm text-slate-500">Track your wishlist, compare specs and prices, and grow your collection.</p>
      </div>
      <CollectionView watches={watches} scoreSummaries={summaries} />
    </div>
  );
}
