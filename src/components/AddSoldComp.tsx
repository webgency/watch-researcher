"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, type Condition, type SoldComp } from "@/lib/types";

const EMPTY = { amount: "", currency: "USD", condition: "pre-owned" as Condition, soldAt: "", source: "", url: "", notes: "" };

/**
 * Manual entry for a completed sale. Local only — the published export has no
 * API to write to, so the market chapter never renders this there.
 *
 * Price, condition, date and source are all required before the save button
 * does anything: a comp missing any of them cannot be judged later, and the
 * store would reject it anyway.
 */
export default function AddSoldComp({ watchId, existing }: { watchId: string; existing: SoldComp[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function save() {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter the sold price.");
    if (!values.soldAt) return setError("Enter the date it sold.");
    if (!values.source.trim()) return setError("Enter where you saw the sale.");

    const comp: SoldComp = {
      price: { amount, currency: values.currency },
      condition: values.condition,
      // A date input gives a calendar day; store it as an instant like every
      // other date in the file.
      soldAt: new Date(`${values.soldAt}T12:00:00Z`).toISOString(),
      source: values.source.trim(),
    };
    if (values.url.trim()) comp.url = values.url.trim();
    if (values.notes.trim()) comp.notes = values.notes.trim();

    setSaving(true);
    try {
      const res = await fetch(`/api/watches/${watchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soldComps: [...existing, comp] }),
      });
      if (!res.ok) throw new Error();
      setValues(EMPTY);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save that sale. Check the values and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary h-9 rounded-full px-4 text-sm" onClick={() => setOpen(true)}>
        Add sold comp
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-cocoa-200 bg-cocoa-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="label">Sold price</span>
          <div className="flex gap-2">
            <input
              className="input"
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="5200"
            />
            <select className="input w-28" value={values.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className="label">Condition</span>
          <select
            className="input"
            value={values.condition}
            onChange={(e) => set("condition", e.target.value as Condition)}
          >
            <option value="pre-owned">Pre-owned</option>
            <option value="new">New</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Sold on</span>
          <input className="input" type="date" value={values.soldAt} onChange={(e) => set("soldAt", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Source</span>
          <input
            className="input"
            value={values.source}
            onChange={(e) => set("source", e.target.value)}
            placeholder="auction house, forum, dealer"
          />
        </label>
        <label className="block">
          <span className="label">Link (optional)</span>
          <input className="input" value={values.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        </label>
        <label className="block">
          <span className="label">Notes (optional)</span>
          <input
            className="input"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="full set, papers"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save sold comp"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setOpen(false);
            setValues(EMPTY);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
