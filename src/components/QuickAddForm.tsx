"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, RetailerLink, Watch, WatchInput, WatchSpecs, WatchStatus, WATCH_STATUSES } from "@/lib/types";
import { hostname } from "@/lib/format";
import ImageDropzone from "./ImageDropzone";

/**
 * A pared-down "add a watch in 10 seconds" form: brand, model, price, a link,
 * a drag-&-drop image, and the favorite flag. For full specs, edit the watch
 * afterwards with the detailed form.
 */
export default function QuickAddForm() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<WatchStatus>("wishlist");
  const [favorite, setFavorite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [scrapedSpecs, setScrapedSpecs] = useState<WatchSpecs>({});
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  // Paste a URL -> pre-fill the visible fields and capture specs for the payload.
  async function fetchFromUrl() {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) {
      setFetchMsg("Enter a full http(s) link first.");
      return;
    }
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch("/api/watches/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't fetch that page.");

      const filled: string[] = [];
      if (data.brand) { setBrand(data.brand); filled.push("brand"); }
      if (data.model) { setModel(data.model); filled.push("model"); }
      if (data.price?.amount) {
        setPriceAmount(String(data.price.amount));
        if (data.price.currency) setPriceCurrency(data.price.currency);
        filled.push("price");
      }
      if (data.imageUrl) { setImageUrl(data.imageUrl); filled.push("image"); }
      if (data.referenceNumber) setReferenceNumber(data.referenceNumber);
      const specCount = data.specs ? Object.keys(data.specs).length : 0;
      if (specCount) { setScrapedSpecs(data.specs); filled.push(`${specCount} spec${specCount > 1 ? "s" : ""}`); }

      setFetchMsg(
        filled.length
          ? `Filled ${filled.join(", ")}.${specCount ? " Specs are saved — open the watch and Edit to review them." : ""}`
          : "Couldn't find much on that page — fill it in manually, or use the full form."
      );
    } catch (err) {
      setFetchMsg(err instanceof Error ? err.message : "Couldn't fetch that page.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand.trim() || !model.trim()) {
      setError("Brand and model are required.");
      return;
    }
    setSubmitting(true);

    const amount = Number(priceAmount);
    const hasPrice = priceAmount.trim() !== "" && Number.isFinite(amount);
    const links: RetailerLink[] = url.trim()
      ? [
          {
            url: url.trim(),
            retailer: hostname(url.trim()),
            ...(hasPrice ? { price: { amount, currency: priceCurrency } } : {}),
          },
        ]
      : [];

    const payload: WatchInput = {
      brand: brand.trim(),
      model: model.trim(),
      referenceNumber: referenceNumber.trim() || undefined,
      status,
      favorite: favorite || undefined,
      imageUrl: imageUrl || undefined,
      specs: scrapedSpecs,
      tags: [],
      links,
      ...(hasPrice ? { price: { amount, currency: priceCurrency } } : {}),
    };

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const saved = (await res.json()) as Watch;
      router.push(`/watch/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Brand *</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Omega" autoFocus />
          </div>
          <div>
            <label className="label">Model *</label>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Seamaster Diver 300M" />
          </div>
          <div>
            <label className="label">Price</label>
            <div className="flex gap-2">
              <input className="input" inputMode="decimal" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} placeholder="5600" />
              <select className="input w-28" value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)}>
              {WATCH_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Link</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://retailer.com/product"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    fetchFromUrl();
                  }
                }}
              />
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={fetchFromUrl} disabled={fetching}>
                {fetching ? "Fetching…" : "Fetch details"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Paste a product URL and fetch to auto-fill brand, price, image, and specs.</p>
            {fetchMsg && <p className="mt-1 text-xs text-slate-600">{fetchMsg}</p>}
          </div>
        </div>

        <div>
          <label className="label">Image</label>
          <ImageDropzone value={imageUrl} onChange={setImageUrl} />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-4 w-4 accent-rose-600" />
          ♥ Add to favorites
        </label>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Add watch"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
