import Link from "next/link";
import { getWatchesByIds } from "@/lib/store";
import CompareTable from "@/components/CompareTable";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  const ids = (searchParams.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const watches = await getWatchesByIds(ids);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare</h1>
          <p className="text-sm text-slate-500">
            {watches.length} watch{watches.length === 1 ? "" : "es"} side by side · best value in each row highlighted.
          </p>
        </div>
        <Link href="/" className="btn-secondary">
          ← Back
        </Link>
      </div>

      {watches.length < 2 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Select at least two watches from your collection to compare them.
          <div className="mt-4">
            <Link href="/" className="btn-primary">
              Go to collection
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <CompareTable watches={watches} />
        </div>
      )}
    </div>
  );
}
