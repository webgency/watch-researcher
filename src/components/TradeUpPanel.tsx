"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { candidateCost, tradeUpBridge, type TradeUpBasis, type TradeUpModel } from "@/lib/trade-up";
import { formatDate, formatMoney } from "@/lib/format";
import { RATES_AS_OF } from "@/lib/currency-rates.mjs";
import { IS_STATIC } from "@/lib/config";
import ConfidenceChip from "./ConfidenceChip";
import FreshnessBadge from "./FreshnessBadge";

function usd(amount: number) {
  return formatMoney({ amount, currency: "USD" });
}

function signedUsd(amount: number) {
  return `${amount < 0 ? "−" : amount > 0 ? "+" : ""}${usd(Math.abs(amount))}`;
}

export default function TradeUpPanel({ model }: { model: TradeUpModel }) {
  const selectId = useId();
  const [candidateId, setCandidateId] = useState("");
  const [basis, setBasis] = useState<TradeUpBasis>("ask");
  const { exit } = model;
  const candidate = model.candidates.find((item) => item.id === candidateId);
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
              <p className="text-sm font-semibold text-cocoa-800">Insufficient pre-owned evidence</p>
              <p className="text-sm text-cocoa-500">{exit.observations.length} of 2 independent dated sources. Add pre-owned asks from different sellers to estimate an exit range.</p>
              <p className="text-xs text-cocoa-500">New retail prices and your purchase price do not fill this gap.</p>
            </div>
          )}
          {(exit.freshness === "stale" || exit.freshness === "expired") && (
            <p className="mt-3 text-sm text-amber-800">These asks are old. Refresh the evidence before relying on this comparison.</p>
          )}
          {exit.observations.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="min-h-11 cursor-pointer rounded py-3 font-medium text-cocoa-700">Sources and dates</summary>
              <ul className="divide-y divide-cocoa-100">
                {exit.observations.map((item, i) => (
                  <li key={`${item.source}-${i}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs text-cocoa-500">
                    <span className="break-words">{item.source} · {formatDate(item.observedAt)}</span>
                    <span className="font-semibold text-cocoa-700">{usd(item.priceUsd)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-azalea-700">
            <a href="#market" className="inline-flex min-h-11 items-center hover:underline">Review market evidence</a>
            {!IS_STATIC && <Link href={`/watch/${model.watchId}/edit`} className="inline-flex min-h-11 items-center hover:underline">Add dated asks</Link>}
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <label htmlFor={selectId} className="block text-base font-semibold text-cocoa-900">Your next watch</label>
          {model.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-cocoa-500">No wishlist watches yet. Add one to compare the next move.</p>
          ) : (
            <select
              id={selectId}
              className="input mt-3 min-h-11"
              value={candidateId}
              onChange={(event) => {
                const next = model.candidates.find((item) => item.id === event.target.value);
                setCandidateId(event.target.value);
                // Prefer a dated ask. A target-only candidate is an explicitly
                // labelled planning scenario, never a claim of availability.
                setBasis(next?.best.status === "available" ? "ask" : next?.target ? "target" : "ask");
              }}
            >
              <option value="">Choose a wishlist watch</option>
              {model.candidates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
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
                        <input type="radio" name={`${selectId}-basis`} checked={basis === value} onChange={() => setBasis(value)} className="accent-cocoa-900" />
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
              ) : <p className="text-sm text-cocoa-500">No dated ask or usable target recorded. Open this watch to add one.</p>}
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
