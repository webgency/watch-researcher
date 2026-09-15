"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Condition, RetailerLink } from "@/lib/types";
import { listingCheckOutcome, listingRevision, todayInputDate, type ListingCheckOutcome } from "@/lib/listing-entry";
import { formatDate, formatMoney } from "@/lib/format";
import { IS_STATIC } from "@/lib/config";
import ListingEditor from "./ListingEditor";

type Phase = "idle" | "checking" | "review" | "editing";

/**
 * Re-read one listing's price from its retailer page, then ask before saving.
 * Always a review step: a scraper can land on the wrong variant, and an
 * unreviewed "unchanged" would quietly re-date a listing nobody looked at.
 * Saving goes through the same focused listing write as Edit listing, so an
 * unchanged price advances only observedAt and never adds a history move.
 */
export default function ListingCheck({ watchId, watchLabel, links, link, condition }: {
  watchId: string;
  watchLabel: string;
  links: RetailerLink[];
  link: RetailerLink;
  condition: Condition;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const review = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Exclude<ListingCheckOutcome, { kind: "no-price" }>>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (phase === "review") review.current?.focus(); }, [phase]);

  if (IS_STATIC) return null;

  function reset() {
    setPhase("idle");
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function check() {
    setPhase("checking");
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/watches/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      const result = listingCheckOutcome(link, data);
      if (result.kind === "no-price") {
        setError("No price found on the retailer page. Use Edit listing to enter what you see.");
        setPhase("idle");
        return;
      }
      setOutcome(result);
      setPhase("review");
    } catch {
      setError("Couldn't read the retailer page. Use Edit listing to enter what you see.");
      setPhase("idle");
    }
  }
  async function save() {
    if (!outcome || !link.condition) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/watches/${encodeURIComponent(watchId)}/listings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { url: link.url, amount: String(outcome.price.amount), currency: outcome.price.currency, condition: link.condition, observedAt: todayInputDate() },
          revision: listingRevision(link),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) router.refresh();
        throw new Error(result.error || "Couldn't save. Try again, or use Edit before saving.");
      }
      setSaved(outcome.kind === "unchanged" ? `Confirmed ${formatMoney(outcome.price)}, seen today.` : `Saved ${formatMoney(outcome.price)}, seen today.`);
      reset();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save. Try again, or use Edit before saving.");
    } finally { setBusy(false); }
  }

  if (phase === "editing" && outcome) {
    return (
      <ListingEditor
        watchId={watchId}
        watchLabel={watchLabel}
        links={links}
        condition={condition}
        initial={link}
        prefill={{ amount: String(outcome.price.amount), currency: outcome.price.currency, observedAt: todayInputDate() }}
        startOpen
        onClose={reset}
        onSaved={setSaved}
      />
    );
  }

  return (
    <div className={phase === "review" ? "w-full" : undefined}>
      {phase !== "review" && (
        <button ref={trigger} type="button" onClick={check} disabled={phase === "checking"} className="inline-flex min-h-11 items-center text-sm font-medium text-azalea-700 hover:underline disabled:text-cocoa-400">
          {phase === "checking" ? "Checking price…" : "Check price"}
        </button>
      )}
      {phase === "review" && outcome && (
        <div ref={review} tabIndex={-1} role="group" aria-label={`Price check for ${link.retailer || link.url}`} className="mt-2 rounded-lg border border-cocoa-200 bg-cocoa-50 p-4 text-sm">
          {outcome.kind === "unchanged" ? (
            <p className="text-cocoa-800">Still <span className="font-semibold tabular-nums">{formatMoney(outcome.price)}</span> on the retailer page. <span className="text-cocoa-500">Last recorded {link.observedAt ? formatDate(link.observedAt) : "without a date"}.</span></p>
          ) : (
            <>
              <p className="text-cocoa-800">Retailer page now asks <span className="font-semibold tabular-nums">{formatMoney(outcome.price)}</span> <span className="text-cocoa-500">(was {formatMoney(link.price)}{link.observedAt ? `, seen ${formatDate(link.observedAt)}` : ""})</span></p>
              <p className="mt-1 text-xs text-cocoa-500">Saving records a price move dated today. Brand, image and specs are not touched.</p>
              {outcome.currencyChanged && <p className="mt-1 text-xs text-amber-800">The currency changed, so this listing&apos;s price trail starts over.</p>}
            </>
          )}
          <p className="mt-1 text-xs text-cocoa-500">
            Compare with the <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-azalea-700 hover:underline">retailer page ↗</a> before saving; a page can show a different variant.
          </p>
          {outcome.missingCondition && <p className="mt-1 text-xs text-amber-800">This listing has no condition recorded. Choose one before saving.</p>}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            {!outcome.missingCondition && (
              <button type="button" className="btn-primary min-h-11" onClick={save} disabled={busy}>
                {busy ? "Saving…" : outcome.kind === "unchanged" ? "Confirm seen today" : `Save ${formatMoney(outcome.price)} · today`}
              </button>
            )}
            <button type="button" className="btn-secondary min-h-11" onClick={() => setPhase("editing")} disabled={busy}>Edit before saving</button>
            <button type="button" className="btn-secondary min-h-11" onClick={reset} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {phase !== "review" && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && phase === "idle" && <p role="status" className="text-sm text-cocoa-600">{saved}</p>}
    </div>
  );
}
