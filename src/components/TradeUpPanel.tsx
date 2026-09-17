"use client";

import { useId } from "react";
import Link from "next/link";
import { candidateCost, tradeUpBridge, type TradeUpModel } from "@/lib/trade-up";
import { formatDate, formatMoney } from "@/lib/format";
import { RATES_AS_OF } from "@/lib/currency-rates.mjs";
import { IS_STATIC } from "@/lib/config";
import ConfidenceChip from "./ConfidenceChip";
import FreshnessBadge from "./FreshnessBadge";
import ListingEditor from "./ListingEditor";
import ListingCheck from "./ListingCheck";
import TargetEditor from "./TargetEditor";
import CandidatePicker from "./CandidatePicker";
import { listingEligibility } from "@/lib/listing-entry";
import { useTradeUpSelection } from "@/hooks/useResearchSession";
import { hostname } from "@/lib/format";

function usd(amount: number) {
  return formatMoney({ amount, currency: "USD" });
}

function signedUsd(amount: number) {
  return `${amount < 0 ? "−" : amount > 0 ? "+" : ""}${usd(Math.abs(amount))}`;
}

export default function TradeUpPanel({ model }: { model: TradeUpModel }) {
  const selectId = useId();
  const selection = useTradeUpSelection(model.watchId, model.candidates.map(item => item.id));
  const { exit } = model;
  const candidate = model.candidates.find((item) => item.id === selection.candidateId);
  const basis = candidate?.target && (selection.basis === "target" || candidate.best.status !== "available") ? "target" : "ask";
  const evidence = listingEligibility(model.links, "pre-owned", new Date(model.asOf));
  const cost = candidate ? candidateCost(candidate, basis) : undefined;
  const bridge = tradeUpBridge(exit, cost);
  const hasExit = exit.medianUsd !== undefined && exit.lowUsd !== undefined && exit.highUsd !== undefined;

  return (
    <section aria-labelledby="trade-up-heading" className="space-y-4">
      <div>
        <h2 id="trade-up-heading" className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">Trade-up</h2>
        <p className="mt-1 text-sm text-cocoa-500">What moving from this watch to a wishlist piece could require.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card min-w-0 p-5">
          <h3 className="text-base font-semibold text-cocoa-900">Exit range · pre-owned asks</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ConfidenceChip confidence={exit.confidence} />
            {exit.freshness && <FreshnessBadge tier={exit.freshness} />}
          </div>
          {hasExit ? (
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums text-cocoa-950">{usd(exit.medianUsd!)} <span className="text-sm font-normal text-cocoa-500">median ask</span></p>
              <p className="mt-1 text-sm text-cocoa-600">Range {usd(exit.lowUsd!)}–{usd(exit.highUsd!)}</p>
              <p className="mt-2 text-xs text-cocoa-500">From {exit.observations.length} independent, dated pre-owned sources. Asking prices are not confirmed sale proceeds.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-cocoa-800">{exit.observations.length} of 2 qualifying sources</p>
              <p className="text-sm text-cocoa-500">Add {2 - exit.observations.length} {exit.observations.length ? "more pre-owned listing from another source" : "pre-owned listings"} to estimate your watch&apos;s asking range.</p>
              <p className="text-xs text-cocoa-500">New retail prices and your purchase price do not fill this gap.</p>
            </div>
          )}
          {(exit.freshness === "stale" || exit.freshness === "expired") && (
            <p className="mt-3 text-sm text-amber-800">{IS_STATIC ? "These asks are old, so this comparison may be out of date." : "These asks are old. Check each listing's price below before relying on this comparison."}</p>
          )}
          {!IS_STATIC ? (
            <ListingEditor watchId={model.watchId} watchLabel={model.watchLabel} links={model.links} condition="pre-owned" label="Add pre-owned listing" primary />
          ) : <p className="mt-3 text-sm text-cocoa-500">This published view is read-only. Add or update listings in your local Vitrine app, then republish to update this estimate.</p>}
          {evidence.length > 0 && (
            // Open when the asks are old, so the Check price actions the
            // warning points to are visible rather than folded away.
            <details open={exit.freshness === "stale" || exit.freshness === "expired"} className="mt-4 text-sm">
              <summary className="min-h-11 cursor-pointer rounded py-3 font-medium text-cocoa-700">Listings used and excluded</summary>
              <ul className="divide-y divide-cocoa-100">
                {evidence.map(({ link, reasons }, i) => (
                  <li key={`${link.url}-${i}`} className="py-3 text-xs text-cocoa-500">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all font-medium text-azalea-700 hover:underline">{link.retailer || hostname(link.url)} ↗</a>
                    <p>{formatMoney(link.price)} · {formatDate(link.observedAt)}</p>
                    <p className="mt-1">{reasons.length ? `Not used: ${reasons.join(". ")}.` : "Counts toward the pre-owned estimate."}</p>
                    {!IS_STATIC && (
                      <div className="flex flex-wrap items-start gap-x-4">
                        <ListingCheck watchId={model.watchId} watchLabel={model.watchLabel} links={model.links} link={link} condition="pre-owned" />
                        <ListingEditor watchId={model.watchId} watchLabel={model.watchLabel} links={model.links} condition="pre-owned" initial={link} label="Edit listing" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-azalea-700">
            <a href="#market" className="inline-flex min-h-11 items-center hover:underline">Review market evidence</a>
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <label htmlFor={selectId} className="block text-base font-semibold text-cocoa-900">Your next watch</label>
          {model.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-cocoa-500">No wishlist watches yet. Add one to compare the next move.</p>
          ) : (
            <CandidatePicker
              id={selectId}
              candidates={model.candidates}
              selectedId={selection.candidateId}
              onSelect={(candidateId) => {
                const next = model.candidates.find((item) => item.id === candidateId);
                // Prefer a dated ask. A target-only candidate is an explicitly
                // labelled planning scenario, never a claim of availability.
                selection.update({ candidateId, basis: next?.best.status === "available" ? "ask" : next?.target ? "target" : "ask" });
              }}
            />
          )}
          {candidate && (
            <div className="mt-4 space-y-3">
              <Link href={`/watch/${candidate.id}`} className="inline-block break-words text-sm font-semibold text-azalea-700 hover:underline">{candidate.label} ↗</Link>
              {candidate.best.status === "available" && candidate.target && (
                <fieldset>
                  <legend className="text-xs font-semibold text-cocoa-500">Compare using</legend>
                  <div className="flex flex-wrap gap-x-4">
                    {(["ask", "target"] as const).map((value) => (
                      <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-cocoa-700">
                        <input type="radio" name={`${selectId}-basis`} checked={basis === value} onChange={() => selection.update({ candidateId: selection.candidateId, basis: value })} className="accent-cocoa-900" />
                        {value === "ask" ? "Best dated ask" : "Your target"}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {basis === "ask" && candidate.best.status === "available" ? (
                <div className="space-y-2">
                  <p className="text-xl font-bold text-cocoa-900">{formatMoney(candidate.best.offer.price)}</p>
                  <p className="text-xs text-cocoa-500">Best dated ask · {candidate.best.offer.condition ?? "condition unknown"} · as of {formatDate(candidate.best.offer.observedAt)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={candidate.best.offer.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-medium text-azalea-700 hover:underline">{candidate.best.offer.source} ↗</a>
                    <FreshnessBadge tier={candidate.best.offer.freshness} />
                  </div>
                  {candidate.best.conditionMatch !== "matched" && <p className="text-xs text-amber-800">No dated {candidate.best.preferredCondition} ask; this offer is {candidate.best.offer.condition ?? "of unknown condition"}.</p>}
                </div>
              ) : basis === "target" && candidate.target ? (
                <div>
                  <p className="text-xl font-bold text-cocoa-900">{formatMoney(candidate.target.price)}</p>
                  <p className="mt-1 text-xs text-cocoa-500">Your target · a planning amount, not an available listing.</p>
                </div>
              ) : <p className="text-sm text-cocoa-500">No dated ask or usable target recorded for this watch yet.</p>}
              {!IS_STATIC && (
                // Keyed by candidate so a half-filled form never carries over to
                // a different watch after the selection changes.
                <div key={candidate.id} className="rounded-lg border border-cocoa-100 px-3 py-1">
                  <p className="pt-2 text-xs text-cocoa-500">Changes here update {candidate.label}. Your selection stays.</p>
                  <div className="flex flex-wrap items-start gap-x-4">
                    <ListingEditor watchId={candidate.id} watchLabel={candidate.label} links={candidate.links} condition={candidate.best.preferredCondition} label="Add candidate listing" />
                    <TargetEditor watchId={candidate.id} watchLabel={candidate.label} target={candidate.targetPrice} label={candidate.targetPrice ? "Edit candidate target" : "Set candidate target"} />
                  </div>
                </div>
              )}
              <div role="status" className="border-t border-cocoa-200 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">Bridge · candidate cost minus exit</h3>
                {bridge.status === "available" ? (
                  <>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-cocoa-950">{signedUsd(bridge.medianUsd)}</p>
                    <p className="mt-1 text-sm text-cocoa-600">{bridge.medianUsd > 0 ? "Additional amount above the exit median." : bridge.medianUsd < 0 ? "Candidate costs less than the exit median." : "Candidate cost matches the exit median."}</p>
                    <p className="mt-2 text-xs text-cocoa-500">Across the exit range: {signedUsd(bridge.lowUsd)} to {signedUsd(bridge.highUsd)}. Negative means the candidate costs less.</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-cocoa-600">{bridge.reason === "exit" ? "No bridge estimate until there is enough pre-owned exit evidence." : "No bridge estimate without a dated candidate ask or a target."}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-cocoa-500">Listed asking prices only; fees, shipping, tax and duty are not included. Actual sale proceeds may differ. This comparison does not change your wishlist priorities or scores. Evidence assessed {formatDate(model.asOf)}; currency conversions use the saved {formatDate(RATES_AS_OF)} rates.</p>
    </section>
  );
}
