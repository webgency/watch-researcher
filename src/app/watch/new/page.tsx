import Link from "next/link";
import { brandReputationMap, getBrands } from "@/lib/brands";
import WatchForm from "@/components/WatchForm";

export default async function NewWatchPage() {
  const brands = await getBrands();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Add a watch</h1>
        <Link href="/" className="btn-secondary">
          ← Back
        </Link>
      </div>
      <WatchForm brandReputations={brandReputationMap(brands)} />
    </div>
  );
}
