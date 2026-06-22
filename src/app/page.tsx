import { getWatches } from "@/lib/store";
import CollectionView from "@/components/CollectionView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const watches = await getWatches();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your collection</h1>
        <p className="text-sm text-slate-500">Track your wishlist, compare specs and prices, and grow your collection.</p>
      </div>
      <CollectionView watches={watches} />
    </div>
  );
}
