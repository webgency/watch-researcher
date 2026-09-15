"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/types";
import { parseSoldCompFields, type SoldCompErrors, type SoldCompFields } from "@/lib/sold-comp-entry";
import { IS_STATIC } from "@/lib/config";

const EMPTY: SoldCompFields = { amount: "", currency: "USD", condition: "pre-owned", soldAt: "", source: "", url: "", notes: "" };

/**
 * Manual entry for a completed sale, following the listing editor's
 * conventions: focus moves into the form and back, errors sit beside their
 * fields, a failed save keeps the draft, and the request carries one sale
 * rather than the whole list.
 *
 * Price, condition, date and source are required: a comp missing any of them
 * cannot be judged later. Local only; the published export has no API.
 */
export default function AddSoldComp({ watchId, watchLabel }: { watchId: string; watchLabel: string }) {
  const router = useRouter();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<SoldCompErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) amountInput.current?.focus(); }, [open]);

  if (IS_STATIC) return null;

  function set(key: keyof SoldCompFields, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setError("");
  }
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function fieldProps(key: keyof SoldCompFields) {
    return { id: `${id}-${key}`, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined };
  }
  function fieldError(key: keyof SoldCompFields) {
    return errors[key] ? <p id={`${id}-${key}-error`} className="mt-1 text-sm text-red-700">{errors[key]}</p> : null;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseSoldCompFields(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/watches/${encodeURIComponent(watchId)}/sold-comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: values }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.errors) setErrors(result.errors);
        throw new Error(result.error || "Couldn't record the sale. Your draft is still here; try again.");
      }
      setValues(EMPTY);
      setSaved("Sale recorded.");
      close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't record the sale. Your draft is still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={open ? "w-full" : undefined}>
      <div className="flex flex-wrap items-center gap-x-3">
        {saved && !open && <p role="status" className="text-sm text-cocoa-600">{saved}</p>}
        <button ref={trigger} type="button" className={`${open ? "hidden" : "inline-flex"} btn-secondary min-h-11 items-center rounded-full px-4 text-sm`} aria-expanded={open} aria-controls={`${id}-form`} onClick={() => { setErrors({}); setError(""); setSaved(""); setOpen(true); }}>
          Record a completed sale
        </button>
      </div>

      {open && (
        <form id={`${id}-form`} noValidate onSubmit={save} className="mt-3 rounded-lg border border-cocoa-200 bg-cocoa-50 p-4">
          <h4 className="text-sm font-semibold text-cocoa-900">Record a completed sale for {watchLabel}</h4>
          <p className="mt-1 text-xs text-cocoa-500">For context beside the asks. Recorded sales never feed the asking range, deal comparison or trade-up estimate.</p>
          <fieldset disabled={saving} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor={`${id}-amount`} className="label">Sold price</label>
              <div className="flex gap-2">
                <input {...fieldProps("amount")} ref={amountInput} className="input min-h-11" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="5200" />
                <select {...fieldProps("currency")} aria-label="Currency" className="input min-h-11 w-28" value={values.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
              {fieldError("amount")}
              {fieldError("currency")}
            </div>
            <div>
              <label htmlFor={`${id}-condition`} className="label">Condition</label>
              <select {...fieldProps("condition")} className="input min-h-11" value={values.condition} onChange={(e) => set("condition", e.target.value)}>
                <option value="pre-owned">Pre-owned</option>
                <option value="new">New</option>
              </select>
              {fieldError("condition")}
            </div>
            <div>
              <label htmlFor={`${id}-soldAt`} className="label">Sold on</label>
              <input {...fieldProps("soldAt")} className="input min-h-11" type="date" value={values.soldAt} onChange={(e) => set("soldAt", e.target.value)} />
              {fieldError("soldAt")}
            </div>
            <div>
              <label htmlFor={`${id}-source`} className="label">Source</label>
              <input {...fieldProps("source")} className="input min-h-11" value={values.source} onChange={(e) => set("source", e.target.value)} placeholder="auction house, forum, dealer" />
              {fieldError("source")}
            </div>
            <div>
              <label htmlFor={`${id}-url`} className="label">Link (optional)</label>
              <input {...fieldProps("url")} className="input min-h-11" type="url" value={values.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
              {fieldError("url")}
            </div>
            <div>
              <label htmlFor={`${id}-notes`} className="label">Notes (optional)</label>
              <input {...fieldProps("notes")} className="input min-h-11" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="full set, papers" />
            </div>
          </fieldset>

          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="btn-primary min-h-11" disabled={saving}>{saving ? "Saving…" : "Save sale"}</button>
            <button type="button" className="btn-secondary min-h-11" onClick={close} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
