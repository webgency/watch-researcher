import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getWatch, getWatches } from "@/lib/store";
import { SPEC_FIELDS, formatSpecValue } from "@/lib/specs";
import { formatMoney, formatDate, hostname } from "@/lib/format";
import { IS_STATIC } from "@/lib/config";
import StatusBadge from "@/components/StatusBadge";
import WishlistTierBadge from "@/components/WishlistTierBadge";
import WatchActions from "@/components/WatchActions";

// Pre-render a detail page for every watch in the static export. In dynamic
// mode return nothing so pages render on demand and reflect edits immediately.
export async function generateStaticParams() {
  if (!IS_STATIC) return [];
  const watches = await getWatches();
  return watches.map((w) => ({ id: w.id }));
}

export default async function WatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!IS_STATIC) noStore();
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="btn-secondary">
          ← Collection
        </Link>
        {!IS_STATIC && <WatchActions id={watch.id} name={`${watch.brand} ${watch.model}`} />}
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div className="card flex h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
          {watch.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={watch.imageUrl} alt={`${watch.brand} ${watch.model}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-5xl font-bold text-slate-300">{(watch.brand[0] ?? "?").toUpperCase()}</span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">{watch.brand}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{watch.model}</h1>
              <WishlistTierBadge tier={watch.wishlistTier} />
              <StatusBadge status={watch.status} />
            </div>
            {watch.referenceNumber && <p className="text-sm text-slate-500">Ref. {watch.referenceNumber}</p>}
          </div>

          <p className="text-3xl font-bold">{formatMoney(watch.price)}</p>
          {watch.priceUpdatedAt && (
            <p className="text-xs text-slate-400">Price updated {formatDate(watch.priceUpdatedAt)}</p>
          )}

          {watch.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {watch.tags.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400">Added {formatDate(watch.dateAdded)}</p>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Specifications</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {SPEC_FIELDS.map((f) => (
            <div key={String(f.key)} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-sm text-slate-500">{f.label}</dt>
              <dd className="text-sm font-medium capitalize">{formatSpecValue(f, watch.specs[f.key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      {watch.links.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Where to buy</h2>
          <ul className="space-y-2">
            {watch.links.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                  {l.retailer || hostname(l.url)}
                </a>
                <div className="flex items-center gap-3 text-sm">
                  {l.condition && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{l.condition}</span>}
                  <span className="font-semibold">{formatMoney(l.price)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {watch.notes && (
        <section className="card p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{watch.notes}</p>
        </section>
      )}
    </div>
  );
}
