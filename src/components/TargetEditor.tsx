"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, type Money } from "@/lib/types";
import { parseTargetFields, targetRevision, type TargetErrors, type TargetFields } from "@/lib/target-entry";
import { IS_STATIC } from "@/lib/config";

function fieldsFor(target?: Money): TargetFields {
  return { amount: target ? String(target.amount) : "", currency: target?.currency ?? "USD" };
}

/** Set, change or clear one watch's target where the target is read. Its
 * request carries only the target, never the rest of the watch. */
export default function TargetEditor({ watchId, watchLabel, target, label, summary }: {
  watchId: string;
  watchLabel: string;
  target?: Money;
  label: string;
  /** What the target currently means, shown beside the trigger. */
  summary?: React.ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(() => fieldsFor(target));
  const [revision, setRevision] = useState("");
  const [errors, setErrors] = useState<TargetErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) amountInput.current?.focus(); }, [open]);

  if (IS_STATIC) return summary ? <div className="text-sm text-cocoa-600">{summary}</div> : null;

  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function change(key: keyof TargetFields, value: string) {
    setFields(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setError("");
  }
  async function send(body: object, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/watches/${encodeURIComponent(watchId)}/target`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, revision }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.errors) setErrors(result.errors);
        if (response.status === 409) router.refresh();
        throw new Error(result.error || "Couldn't save the target. Your draft is still here; try again.");
      }
      setSaved(message);
      close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save the target. Your draft is still here; try again.");
    } finally { setBusy(false); }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseTargetFields(fields);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
      return;
    }
    void send({ fields }, "Target saved.");
  }

  return (
    <div className={open ? "w-full" : undefined}>
      <div className="flex flex-wrap items-center gap-x-3">
        {summary && <div className="text-sm text-cocoa-600">{summary}</div>}
        <button ref={trigger} type="button" className={`${open ? "hidden" : "inline-flex"} min-h-11 items-center text-sm font-medium text-azalea-700 hover:underline`} aria-expanded={open} aria-controls={`${id}-form`} onClick={() => {
          setFields(fieldsFor(target)); setRevision(targetRevision(target)); setErrors({}); setError(""); setSaved(""); setOpen(true);
        }}>{label}</button>
      </div>
      {open && (
        <form id={`${id}-form`} noValidate onSubmit={submit} className="mt-2 rounded-lg border border-cocoa-200 bg-cocoa-50 p-4">
          <h4 className="text-sm font-semibold text-cocoa-900">Target for {watchLabel}</h4>
          <p className="mt-1 text-xs text-cocoa-500">A planning amount, not a listing. Changing it never fires an alert; a later price reaching it does.</p>
          <fieldset disabled={busy} className="mt-3 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <div>
                <label htmlFor={`${id}-amount`} className="label">Target price</label>
                <input id={`${id}-amount`} ref={amountInput} className="input min-h-11" inputMode="decimal" value={fields.amount} onChange={e => change("amount", e.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `${id}-amount-error` : undefined} />
                {errors.amount && <p id={`${id}-amount-error`} className="mt-1 text-sm text-red-700">{errors.amount}</p>}
              </div>
              <div>
                <label htmlFor={`${id}-currency`} className="label">Currency</label>
                <select id={`${id}-currency`} className="input min-h-11" value={fields.currency} onChange={e => change("currency", e.target.value)} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? `${id}-currency-error` : undefined}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select>
                {errors.currency && <p id={`${id}-currency-error`} className="mt-1 text-sm text-red-700">{errors.currency}</p>}
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary min-h-11">{busy ? "Saving…" : "Save target"}</button>
              {target && <button type="button" className="btn-secondary min-h-11" onClick={() => void send({ clear: true }, "Target cleared.")}>Clear target</button>}
              <button type="button" onClick={close} className="btn-secondary min-h-11">Cancel</button>
            </div>
          </fieldset>
        </form>
      )}
      {saved && <p role="status" className="text-sm text-cocoa-600">{saved}</p>}
    </div>
  );
}
