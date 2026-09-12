"use client";

import Link from "next/link";
import { toDisplayScore, type StandingSummary } from "@/lib/scoring";
import { DIMENSION_LABELS } from "@/lib/rubrics";
import { Watch, WishlistTier, WISHLIST_TIERS, WISHLIST_TIER_LABELS } from "@/lib/types";
import { formatMoney, formatOrdinal } from "@/lib/format";
import { targetStatus } from "@/lib/price-history";
import { bestOffer, bestOfferTargetStatus } from "@/lib/valuation";
import FreshnessBadge from "./FreshnessBadge";
import StatusBadge from "./StatusBadge";
import WishlistTierBadge from "./WishlistTierBadge";

function initials(watch: Watch): string {
  const a = watch.brand?.trim()?.[0] ?? "?";
  const b = watch.model?.trim()?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function WatchCard({
  watch,
  selected,
  selectionDisabled,
  scoreSummary,
  onToggleSelect,
  onChangeWishlistTier,
}: {
  watch: Watch;
  selected: boolean;
  selectionDisabled?: boolean;
  scoreSummary?: StandingSummary;
  onToggleSelect: (id: string) => void;
  onChangeWishlistTier?: (id: string, next: WishlistTier | "") => void;
}) {
  const { specs } = watch;
  const target = targetStatus(watch);
  const offer = bestOffer(watch);
  const offerTarget = bestOfferTargetStatus(watch, offer);
  const href = `/watch/${watch.id}`;
  return (
    <div className={`card group relative overflow-hidden transition-shadow hover:shadow-md ${selected ? "ring-2 ring-slate-900" : ""}`}>
      <div className="relative flex h-64 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        {/* Image and title are the navigation. A stretched overlay link would
            cover the Compare checkbox and the priority select, which then need
            z-index and click-stopping to claw their way back out. */}
        <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0">
          {watch.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={watch.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-400">
              {initials(watch)}
            </span>
          )}
        </Link>
        <label className="absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            disabled={selectionDisabled}
            onChange={() => onToggleSelect(watch.id)}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          {selectionDisabled ? "Limit reached" : "Compare"}
        </label>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          {/* Fixed height, because only 41 of 69 watches carry a reference
              number — without it the price row sits a line higher on the cards
              that have none, and nothing in a grid row lines up. */}
          <div className="min-h-[5rem] min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{watch.brand}</p>
            {/* Two lines, not one: model names carry their differentiator at the
                end ("D5 Pacific | Anacapa Auto — 39mm USA"), so a single-line
                truncate hides the part that tells two variants apart. The
                min-height reserves the second line so the price rows of a grid
                row stay aligned whether a title wraps or not. */}
            <Link
              href={href}
              className="block min-h-[2.75rem] font-semibold leading-snug line-clamp-2 group-hover:underline"
            >
              {watch.model}
            </Link>
            {watch.referenceNumber && (
              <p className="truncate text-xs text-slate-400">Ref. {watch.referenceNumber}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
            <WishlistTierBadge tier={watch.wishlistTier} />
            <StatusBadge status={watch.status} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight">{formatMoney(watch.price)}</span>
            {target?.met && (
              <span
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                title={`At or below your ${formatMoney(target.target)} target`}
              >
                at target
              </span>
            )}
          </span>
          <span className="flex-shrink-0 text-xs text-slate-500">
            {[specs.caseDiameterMm ? `${specs.caseDiameterMm}mm` : null, specs.movement].filter(Boolean).join(" · ")}
          </span>
        </div>

        {offer.status === "available" && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="min-w-0 flex-1 truncate font-medium text-slate-700">
                Best offer {formatMoney(offer.offer.price)} · {offer.offer.source}
              </p>
              <FreshnessBadge tier={offer.offer.freshness} ageDays={offer.offer.ageDays} compact />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-slate-500">
              <span className="capitalize">{offer.offer.condition ?? "condition unknown"}</span>
              {offer.conditionMatch === "fallback" && <span>· condition fallback</span>}
              {offer.conditionMatch === "unknown" && <span>· unverified condition</span>}
              {offerTarget?.met && (
                <span
                  className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800"
                  title="Listed price only; shipping and duty are not recorded for this retailer offer"
                >
                  offer at target before extras
                </span>
              )}
            </div>
          </div>
        )}
        {offer.status === "insufficient" && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-400">
            No dated offers{offer.undatedOfferCount ? ` · ${offer.undatedOfferCount} undated price${offer.undatedOfferCount === 1 ? "" : "s"} excluded` : ""}
          </p>
        )}

        {scoreSummary && <StandingBlock summary={scoreSummary} watch={watch} />}

        {watch.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {watch.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {onChangeWishlistTier && (
          <select
            value={watch.wishlistTier ?? ""}
            onChange={(e) => onChangeWishlistTier(watch.id, e.target.value as WishlistTier | "")}
            aria-label={`Set wishlist priority for ${watch.brand} ${watch.model}`}
            className="input h-8 py-1 text-xs"
          >
            <option value="">Set priority</option>
            {WISHLIST_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {WISHLIST_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

type HeroScore = { key: "value" | "design"; label: string; value: number };

/**
 * One number gets to be the card's score. Rubric value answers the question the
 * collection is for — is this watch worth its price — so it leads whenever it is
 * rated; design appeal is the fallback because it is the other score the user
 * enters by hand. Everything else is context and reads as context.
 */
function heroScore(summary: StandingSummary): HeroScore | null {
  const { valueScore } = summary.standing;
  if (valueScore !== undefined) {
    return { key: "value", label: "Rubric value", value: Math.round(toDisplayScore(valueScore)) };
  }
  if (summary.designScore !== null) {
    return { key: "design", label: "Design", value: Math.round(summary.designScore) };
  }
  return null;
}

function StandingBlock({ summary, watch }: { summary: StandingSummary; watch: Watch }) {
  const { standing } = summary;
  const hero = heroScore(summary);
  const dimensionList = (dimensions: typeof standing.beats) =>
    dimensions.map((dimension) => DIMENSION_LABELS[dimension]).join(", ");

  const context: { key: string; text: string; title: string; warn?: boolean }[] = [];
  if (standing.qualityScore !== undefined) {
    context.push({
      key: "quality",
      text: `Quality ${Math.round(toDisplayScore(standing.qualityScore))}`,
      title: "Composite of the rated dimensions",
    });
  }
  if (summary.designScore !== null && hero?.key !== "design") {
    context.push({
      key: "design",
      text: `Design ${Math.round(summary.designScore)}`,
      title: "Your design-appeal score",
    });
  }
  context.push({
    key: "evidence",
    text: `Evidence ${Math.round(standing.evidenceCoverage * 100)}%`,
    title: `${standing.confidence} confidence from recorded scoring inputs`,
    warn: standing.confidence === "low",
  });
  if (watch.personalFit) {
    context.push({ key: "fit", text: `Fit ${watch.personalFit}/5`, title: "Your personal-fit rating" });
  }

  return (
    <div className="space-y-2 text-xs">
      {/* The hero pill is the only filled element in the card body, so the eye
          lands on one score. The rest is a single muted line — present, legible,
          and clearly subordinate — rather than four competing pills. */}
      <div>
        {hero ? (
          <span
            title={
              hero.key === "value"
                ? `Rubric value against the continuous expectation at this price. Peer label: ${standing.peerLabel}. 50 is expected.`
                : "Your design-appeal score"
            }
            className="inline-block rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white"
          >
            {hero.label} {hero.value}
          </span>
        ) : (
          <span
            title="Neither a rubric value nor a design rating has enough recorded input to score"
            className="inline-block rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-400"
          >
            Scores unrated
          </span>
        )}
        {context.length > 0 && (
          <p className="mt-1.5 text-slate-400">
            {context.map((chip, index) => (
              <span key={chip.key} title={chip.title} className={chip.warn ? "text-amber-700" : undefined}>
                {index > 0 && <span className="text-slate-300"> · </span>}
                {chip.text}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Frictions are text, never a score, and they are rare — a card that has
          one is saying something the price and score cannot. Keep them visible. */}
      {standing.frictions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {standing.frictions.map((friction) => (
            <span key={friction} className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
              {friction}
            </span>
          ))}
        </div>
      )}

      <details className="group/detail">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-slate-400 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="transition-transform group-open/detail:rotate-90">
            &#9656;
          </span>
          Score details
        </summary>
        <div className="mt-1.5 space-y-1 pl-3">
          <p className="text-slate-500">
            {standing.peerLabel}
            {standing.qualityPercentile !== undefined &&
              ` · ${formatOrdinal(standing.qualityPercentile * 100)} percentile of ${standing.peerCount} peers`}
          </p>
          {standing.beats.length > 0 && (
            <p className="text-emerald-700">Above expectations: {dimensionList(standing.beats)}</p>
          )}
          {standing.trails.length > 0 && (
            <p className="text-amber-700">Below expectations: {dimensionList(standing.trails)}</p>
          )}
          {standing.unrated.length > 0 && (
            <p
              className="text-slate-400"
              title="No source data recorded for these dimensions, so they are excluded from the scores"
            >
              Unrated: {dimensionList(standing.unrated)}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
