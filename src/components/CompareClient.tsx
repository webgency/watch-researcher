"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Watch } from "@/lib/types";
import CompareTable from "./CompareTable";

// Reads the `?ids=` selection on the client and picks watches out of the full
// list. Doing this client-side (rather than from server searchParams) keeps the
// page statically exportable for GitHub Pages.
function CompareInner({ allWatches }: { allWatches: Watch[] }) {
  const params = useSearchParams();
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const byId = new Map(allWatches.map((w) => [w.id, w]));
  const watches = ids.map((id) => byId.get(id)).filter((w): w is Watch => Boolean(w));

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

export default function CompareClient({ allWatches }: { allWatches: Watch[] }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <CompareInner allWatches={allWatches} />
    </Suspense>
  );
}
