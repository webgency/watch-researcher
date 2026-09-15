"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, type Condition, type RetailerLink } from "@/lib/types";
import { listingEligibility, listingRevision, parseListingFields, todayInputDate, type ListingErrors, type ListingFields } from "@/lib/listing-entry";
import { IS_STATIC } from "@/lib/config";

function fieldsFor(link?: RetailerLink, condition?: Condition): ListingFields {
  return { url: link?.url ?? "", amount: link?.price ? String(link.price.amount) : "", currency: link?.price?.currency ?? "USD", condition: link?.condition ?? (link ? "" : condition ?? ""), observedAt: link?.observedAt?.slice(0, 10) ?? "" };
}

/** One task-sized editor in Market and Trade-up. Its request cannot change
 * headline price/specs or replace the collection's whole links array. */
export default function ListingEditor({ watchId, watchLabel, links, condition, initial, label = "Add listing", primary = false, prefill, startOpen = false, onClose, onSaved }: {
  watchId: string;
  watchLabel: string;
  links: RetailerLink[];
  condition: Condition;
  initial?: RetailerLink;
  label?: string;
  primary?: boolean;
  /** Draft values over the recorded listing, e.g. a price check's result. */
  prefill?: Partial<ListingFields>;
  startOpen?: boolean;
  onClose?: () => void;
  onSaved?: (message: string) => void;
}) {
  const router = useRouter();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(startOpen);
  const [fields, setFields] = useState(() => ({ ...fieldsFor(initial, condition), ...prefill }));
  // Opened by a caller rather than the trigger, so capture the revision now.
  const [revision, setRevision] = useState<string | undefined>(() => startOpen && initial ? listingRevision(initial) : undefined);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) urlInput.current?.focus(); }, [open]);

  if (IS_STATIC) return null;

  function close() {
    setOpen(false);
    if (onClose) onClose();
    else requestAnimationFrame(() => trigger.current?.focus());
  }
  function change(key: keyof ListingFields, value: string) {
    setFields(current => ({ ...current, [key]: value, ...(key === "amount" && initial && value !== current.amount ? { observedAt: "" } : {}) }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setError("");
  }
  const parsed = parseListingFields(fields);
  const previewLinks = initial ? links.filter(link => link.url !== initial.url) : links;
  const preview = parsed.ok ? listingEligibility([...previewLinks, parsed.listing], condition) : undefined;
  const count = preview?.filter(row => !row.reasons.length).length;
  const reason = preview?.at(-1)?.reasons.join(". ");

  function fieldProps(key: keyof ListingFields) {
    return { id: `${id}-${key}`, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined };
  }
  function fieldError(key: keyof ListingFields) {
    return errors[key] ? <p id={`${id}-${key}-error`} className="mt-1 text-sm text-red-700">{errors[key]}</p> : null;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/watches/${encodeURIComponent(watchId)}/listings`, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, revision }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.errors) setErrors(result.errors);
        if (response.status === 409) router.refresh();
        throw new Error(result.error || "Couldn't save the listing. Your draft is still here; try again.");
      }
      const qualifying = listingEligibility(result.links, condition).filter(row => !row.reasons.length).length;
      const message = `Listing saved. ${qualifying >= 2 ? `${qualifying} qualifying sources now support the asking range.` : `${2 - qualifying} more ${condition} ${qualifying === 1 ? "source" : "sources"} needed for an estimate.`}`;
      setSaved(message);
      onSaved?.(message);
      close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save the listing. Your draft is still here; try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className={open ? "w-full" : "my-3"}>
      <button ref={trigger} type="button" className={`${open ? "hidden" : "inline-flex"} min-h-11 items-center ${initial ? "text-sm font-medium text-azalea-700 hover:underline" : primary ? "btn-primary" : "btn-secondary"}`} aria-expanded={open} aria-controls={`${id}-form`} onClick={() => {
        setFields(fieldsFor(initial, condition)); setRevision(initial ? listingRevision(initial) : undefined); setErrors({}); setError(""); setSaved(""); setOpen(true);
      }}>{label}</button>
      {open && (
        <form id={`${id}-form`} noValidate onSubmit={submit} className="mt-3 rounded-lg border border-cocoa-200 bg-cocoa-50 p-4">
          <h4 className="text-sm font-semibold text-cocoa-900">{initial ? "Edit listing" : "Add listing"} for {watchLabel}</h4>
          <p className="mt-1 text-xs text-cocoa-500">Record the asking price, condition, and date from this listing.</p>
          <fieldset disabled={busy} className="mt-4 space-y-3">
            <div>
              <label htmlFor={`${id}-url`} className="label">Listing URL</label>
              <input {...fieldProps("url")} ref={urlInput} className="input min-h-11" type="url" readOnly={Boolean(initial)} value={fields.url} onChange={e => change("url", e.target.value)} placeholder="https://" />
              {fieldError("url")}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <div>
                <label htmlFor={`${id}-amount`} className="label">Asking price</label>
                <input {...fieldProps("amount")} className="input min-h-11" inputMode="decimal" value={fields.amount} onChange={e => change("amount", e.target.value)} />
                {fieldError("amount")}
              </div>
              <div>
                <label htmlFor={`${id}-currency`} className="label">Currency</label>
                <select {...fieldProps("currency")} className="input min-h-11" value={fields.currency} onChange={e => change("currency", e.target.value)}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select>
                {fieldError("currency")}
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-condition`} className="label">Listing condition</label>
              <select {...fieldProps("condition")} className="input min-h-11" value={fields.condition} onChange={e => change("condition", e.target.value)}><option value="">Choose condition</option><option value="pre-owned">Pre-owned</option><option value="new">New</option></select>
              {fieldError("condition")}
            </div>
            <div>
              <label htmlFor={`${id}-observedAt`} className="label">Price seen on</label>
              <input {...fieldProps("observedAt")} className="input min-h-11" type="date" value={fields.observedAt} onChange={e => change("observedAt", e.target.value)} />
              <button type="button" className="min-h-11 text-sm text-azalea-700 hover:underline" onClick={() => change("observedAt", todayInputDate())}>I checked it today</button>
              {fieldError("observedAt")}
            </div>
            <p className="text-xs text-cocoa-600" role="status">{preview ? `${reason ? `${reason}. ` : ""}After saving: ${count} qualifying ${condition} ${count === 1 ? "source" : "sources"}. ${count! < 2 ? "Two are needed for an estimate." : "This supports an asking range."}` : `A ${condition} listing with a price and date can count toward this estimate. Listings from the same site count once.`}</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary min-h-11">{busy ? "Saving…" : "Save listing"}</button>
              <button type="button" onClick={close} className="btn-secondary min-h-11">Cancel</button>
            </div>
          </fieldset>
        </form>
      )}
      {saved && <p role="status" className="mt-2 text-sm text-cocoa-600">{saved}</p>}
    </div>
  );
}
