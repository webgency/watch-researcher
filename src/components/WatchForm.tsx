"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCIES,
  Condition,
  RetailerLink,
  Watch,
  WatchInput,
  WatchSpecs,
  WatchStatus,
  WATCH_STATUSES,
} from "@/lib/types";
import { SPEC_FIELDS } from "@/lib/specs";
import { hostname } from "@/lib/format";
import ImageDropzone from "./ImageDropzone";

interface LinkRow {
  url: string;
  retailer: string;
  priceAmount: string;
  priceCurrency: string;
  condition: "" | Condition;
}

function toLinkRow(link: RetailerLink): LinkRow {
  return {
    url: link.url,
    retailer: link.retailer ?? "",
    priceAmount: link.price?.amount != null ? String(link.price.amount) : "",
    priceCurrency: link.price?.currency ?? "USD",
    condition: link.condition ?? "",
  };
}

function parseNum(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function WatchForm({ initial }: { initial?: Watch }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [referenceNumber, setReferenceNumber] = useState(initial?.referenceNumber ?? "");
  const [status, setStatus] = useState<WatchStatus>(initial?.status ?? "wishlist");
  const [grail, setGrail] = useState(initial?.grail ?? false);
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [priority, setPriority] = useState(initial?.priority != null ? String(initial.priority) : "");
  const [priceAmount, setPriceAmount] = useState(initial?.price?.amount != null ? String(initial.price.amount) : "");
  const [priceCurrency, setPriceCurrency] = useState(initial?.price?.currency ?? "USD");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [specs, setSpecs] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const f of SPEC_FIELDS) {
      const v = initial?.specs?.[f.key];
      s[f.key] = v != null ? String(v) : "";
    }
    return s;
  });
  const [links, setLinks] = useState<LinkRow[]>(
    initial?.links?.length ? initial.links.map(toLinkRow) : [{ url: "", retailer: "", priceAmount: "", priceCurrency: "USD", condition: "" }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setLink(i: number, patch: Partial<LinkRow>) {
    setLinks((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function buildPayload(): WatchInput {
    const builtSpecs: WatchSpecs = {};
    for (const f of SPEC_FIELDS) {
      const raw = specs[f.key]?.trim() ?? "";
      if (raw === "") continue;
      if (f.type === "number") {
        const n = parseNum(raw);
        if (n !== undefined) (builtSpecs[f.key] as number) = n;
      } else {
        (builtSpecs[f.key] as string) = raw;
      }
    }

    const builtLinks: RetailerLink[] = links
      .filter((l) => l.url.trim() !== "")
      .map((l) => {
        const link: RetailerLink = { url: l.url.trim() };
        link.retailer = l.retailer.trim() || hostname(l.url.trim());
        const amount = parseNum(l.priceAmount);
        if (amount !== undefined) link.price = { amount, currency: l.priceCurrency };
        if (l.condition) link.condition = l.condition;
        return link;
      });

    const payload: WatchInput = {
      brand: brand.trim(),
      model: model.trim(),
      referenceNumber: referenceNumber.trim() || undefined,
      status,
      grail: grail || undefined,
      favorite: favorite || undefined,
      priority: parseNum(priority),
      imageUrl: imageUrl.trim() || undefined,
      specs: builtSpecs,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      links: builtLinks,
    };
    const amount = parseNum(priceAmount);
    if (amount !== undefined) payload.price = { amount, currency: priceCurrency };
    return payload;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand.trim() || !model.trim()) {
      setError("Brand and model are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const res = await fetch(isEdit ? `/api/watches/${initial!.id}` : "/api/watches", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const saved = (await res.json()) as Watch;
      router.push(`/watch/${saved.id ?? initial!.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Brand *</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Omega" />
          </div>
          <div>
            <label className="label">Model *</label>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Seamaster Diver 300M" />
          </div>
          <div>
            <label className="label">Reference number</label>
            <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="210.30.42.20.03.003" />
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
          <div>
            <label className="label">Target / tracked price</label>
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
            <label className="label">Wishlist priority</label>
            <input className="input" inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="1 = top of the list" />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-4 w-4 accent-rose-600" />
              ♥ Favorite
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={grail} onChange={(e) => setGrail(e.target.checked)} className="h-4 w-4 accent-slate-900" />
              ★ Grail
            </label>
          </div>
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="diver, GMT, blue dial" />
        </div>
        <div>
          <label className="label">Image</label>
          <ImageDropzone value={imageUrl} onChange={setImageUrl} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Specifications</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPEC_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <label className="label">
                {f.label}
                {f.unit ? ` (${f.unit})` : ""}
              </label>
              {f.type === "select" ? (
                <select className="input" value={specs[f.key]} onChange={(e) => setSpecs((s) => ({ ...s, [f.key]: e.target.value }))}>
                  <option value="">—</option>
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  inputMode={f.type === "number" ? "decimal" : "text"}
                  value={specs[f.key]}
                  onChange={(e) => setSpecs((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Retailer links</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLinks((rows) => [...rows, { url: "", retailer: "", priceAmount: "", priceCurrency: "USD", condition: "" }])}
          >
            + Add link
          </button>
        </div>
        <div className="space-y-3">
          {links.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input sm:col-span-2" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://retailer.com/product" />
                <input className="input" value={l.retailer} onChange={(e) => setLink(i, { retailer: e.target.value })} placeholder="Retailer (optional)" />
                <div className="flex gap-2">
                  <input className="input" inputMode="decimal" value={l.priceAmount} onChange={(e) => setLink(i, { priceAmount: e.target.value })} placeholder="Price" />
                  <select className="input w-24" value={l.priceCurrency} onChange={(e) => setLink(i, { priceCurrency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <select className="input" value={l.condition} onChange={(e) => setLink(i, { condition: e.target.value as LinkRow["condition"] })}>
                  <option value="">Condition…</option>
                  <option value="new">New</option>
                  <option value="pre-owned">Pre-owned</option>
                </select>
              </div>
              <button type="button" className="btn-danger self-start" onClick={() => setLinks((rows) => rows.filter((_, idx) => idx !== i))} aria-label="Remove link">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <label className="label">Notes</label>
        <textarea className="input min-h-[6rem]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why you want it, condition observations, deal history…" />
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add watch"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
