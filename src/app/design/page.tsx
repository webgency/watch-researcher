import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { IS_STATIC } from "@/lib/config";
import { getWatches } from "@/lib/store";
import DesignRanker from "@/components/DesignRanker";

export default async function DesignPage() {
  if (!IS_STATIC) noStore();
  const watches = await getWatches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Design rank</h1>
        <p className="text-sm text-slate-500">
          Your own 1–5 read on how each watch looks. It is the vertical axis of the value matrix, and the one
          judgement in the app that is meant to be yours rather than calculated.
        </p>
      </div>

      {IS_STATIC ? (
        <p className="card p-12 text-center text-sm text-slate-500">
          Ranking needs the live app — this is the static export.
        </p>
      ) : (
        <DesignRanker watches={watches} />
      )}

      <p className="text-sm text-slate-500">
        <Link href="/value" className="font-medium text-blue-600 hover:underline">
          See the value matrix →
        </Link>
      </p>
    </div>
  );
}
