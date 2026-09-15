import { formatAgeDays, formatDate, formatMoney, hostname } from "@/lib/format";
import { dealVerdict } from "@/lib/market-copy";
import { changeSinceFirst } from "@/lib/price-history";
import { soldComps, soldCompSummary } from "@/lib/sold-comps";
import type { Condition, RetailerLink, Watch } from "@/lib/types";
import {
  bestOffer,
  bestOfferTargetStatus,
  dealScore,
  marketValueSummary,
  observationAgeDays,
  freshnessForAge,
  trackedAskCondition,
} from "@/lib/valuation";
import { IS_STATIC } from "@/lib/config";
import AddSoldComp from "./AddSoldComp";
import ConfidenceChip from "./ConfidenceChip";
import FreshnessBadge from "./FreshnessBadge";
import RemoveSoldComp from "./RemoveSoldComp";
import ListingEditor from "./ListingEditor";
import ListingCheck from "./ListingCheck";
import WatchAlertsCard from "./WatchAlertsCard";
import type { AlertState } from "@/lib/alerts.mjs";
import { listingEligibility } from "@/lib/listing-entry";

function usd(amount: number): string {
  return formatMoney({ amount, currency: "USD" });
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-cocoa-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">{label}</p>
      {children}
    </div>
  );
}

/** The tracked price, kept visibly apart from the asks it is compared against. */
function TrackedPriceTile({ watch }: { watch: Watch }) {
  return (
    <Tile label="Your tracked price">
      <p className="mt-1 text-xl font-bold tabular-nums text-cocoa-900">{formatMoney(watch.price)}</p>
      {watch.landedPrice && <p className="text-xs text-cocoa-500">All-in {formatMoney(watch.landedPrice)}</p>}
      {/* The headline price is usually copied from one of the links below.
          Counting it again would manufacture a second independent source. */}
      <p className="mt-2 text-xs text-cocoa-400">The price you are tracking, not an observation. Never counted as market evidence.</p>
    </Tile>
  );
}

function BestAskTile({ watch }: { watch: Watch }) {
  const offer = bestOffer(watch);
  const target = bestOfferTargetStatus(watch, offer);

  if (offer.status === "insufficient") {
    return (
      <Tile label="Best dated ask">
        <p className="mt-1 text-sm text-cocoa-600">No dated offers yet.</p>
        <p className="mt-2 text-xs text-cocoa-400">
          {offer.undatedOfferCount > 0
            ? `${offer.undatedOfferCount} priced link${offer.undatedOfferCount === 1 ? "" : "s"} carry no observation date, so ${offer.undatedOfferCount === 1 ? "it is" : "they are"} excluded from ranking.`
            : "Record a retailer price with the date you saw it."}
        </p>
      </Tile>
    );
  }

  const { offer: best } = offer;
  return (
    <Tile label="Best dated ask">
      <p className="mt-1 text-xl font-bold tabular-nums text-cocoa-900">{formatMoney(best.price)}</p>
      <a
        href={best.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-azalea-700 hover:underline"
      >
        {best.source} ↗
      </a>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs capitalize text-cocoa-500">{best.condition ?? "condition unknown"}</span>
        <FreshnessBadge tier={best.freshness} ageDays={best.ageDays} compact />
      </div>
      {offer.conditionMatch !== "matched" && (
        <p className="mt-2 text-xs text-amber-800">
          {offer.conditionMatch === "fallback"
            ? `No dated ${offer.preferredCondition} offer, so this is a ${best.condition} one.`
            : "This retailer did not record a condition."}
        </p>
      )}
      {target?.met && (
        <p className="mt-2 text-xs font-semibold text-emerald-800">At your target, before shipping and duty.</p>
      )}
    </Tile>
  );
}

function FairRangeTile({ watch }: { watch: Watch }) {
  const deal = dealScore(watch);
  const conditionLabel = deal.evidenceCondition === "pre-owned" ? "pre-owned" : "new";

  return (
    <Tile label={`Fair asking range · ${deal.preferredCondition}`}>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ConfidenceChip confidence={deal.confidence} />
        {deal.freshness && <FreshnessBadge tier={deal.freshness} />}
      </div>
      {deal.status === "insufficient" ? (
        <div className="mt-2">
          <p className="text-sm text-cocoa-600">
            {deal.reason === "missing-ask"
              ? "Add a tracked or landed price before comparing this watch with fair asks."
              : `${deal.observationCount} of 2 independent dated sources for the same condition.`}
          </p>
          {/* No percentage here on purpose: thin evidence must never produce a
              precise-looking deal number. */}
          <p className="mt-2 text-xs text-cocoa-400">
            {deal.reason === "missing-ask"
              ? "No comparison is made without an ask."
              : "Add another dated ask from a different seller. No deal percentage until then."}
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xl font-bold tabular-nums text-cocoa-900">{usd(deal.fairMedianUsd)}</p>
          <p className="text-xs text-cocoa-500">
            median · range {usd(deal.fairLowUsd)}–{usd(deal.fairHighUsd)} · {deal.observationCount} {conditionLabel} sellers
          </p>
          <p className="mt-2 text-sm font-medium text-cocoa-700">{dealVerdict(deal)}</p>
          {deal.usedConditionFallback && (
            <p className="mt-2 text-xs text-amber-800">
              Matching {deal.preferredCondition} evidence was thin, so this uses {conditionLabel} asks.
            </p>
          )}
        </div>
      )}
    </Tile>
  );
}

function ConditionEvidenceLine({ watch, condition }: { watch: Watch; condition: Condition }) {
  const summary = marketValueSummary(watch, condition);
  const label = condition === "new" ? "New" : "Pre-owned";
  return (
    <p className="text-xs text-cocoa-500">
      <span className="font-medium text-cocoa-600">{label}:</span>{" "}
      {summary.medianUsd === undefined
        ? `${summary.observations.length} of 2 sources needed for an estimate`
        : `median ${usd(summary.medianUsd)} from ${summary.observations.length} sellers`}
    </p>
  );
}

/**
 * How one listing's ask has moved since it was first recorded. The change line
 * appears after one move; the step trail only after two, because a single move
 * is already fully described by the line.
 */
function AskTrail({ link }: { link: RetailerLink }) {
  const change = changeSinceFirst(link.askHistory);
  if (!change || !link.askHistory) return null;
  const { amount, currency } = change.delta;
  const size = formatMoney({ amount: Math.abs(amount), currency });

  return (
    <div className="mt-1 text-xs">
      <p className={amount < 0 ? "font-medium text-emerald-800" : "text-cocoa-500"}>
        {amount === 0 ? "Back to its first recorded ask" : `${amount < 0 ? "↓" : "↑"} ${size} since first recorded`} ·{" "}
        {formatDate(change.first.date)}
      </p>
      {change.moves > 1 && (
        <ol aria-label="Ask history" className="mt-1 flex flex-wrap items-start gap-x-2 gap-y-1">
          {link.askHistory.map((snapshot, i) => (
            <li key={i} className="flex items-start gap-2">
              {i > 0 && (
                <span aria-hidden="true" className="text-cocoa-300">
                  →
                </span>
              )}
              <span className="flex flex-col">
                <span className="font-medium tabular-nums text-cocoa-700">{formatMoney(snapshot.price)}</span>
                <span className="text-cocoa-400">{formatDate(snapshot.date)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Every recorded ask, dated first. Undated prices stay visible but are marked,
 * because they are real links the reader may want even though no estimate can
 * use them.
 */
function Asks({ watch }: { watch: Watch }) {
  const condition = trackedAskCondition(watch);
  const eligibility = listingEligibility(watch.links, condition);
  const rows = watch.links.map((link, index) => {
    const ageDays = link.observedAt ? observationAgeDays(link.observedAt) : undefined;
    return { link, ageDays, index };
  });
  const sorted = [...rows].sort((a, b) => {
    if (a.ageDays === undefined) return b.ageDays === undefined ? 0 : 1;
    if (b.ageDays === undefined) return -1;
    return a.ageDays - b.ageDays;
  });
  const dated = rows.filter((row) => row.ageDays !== undefined && row.link.price).length;
  // Stale asks and undated ones both drop out of estimates, so both count as
  // needing attention; each row already carries its own Check price action.
  const attention = sorted.filter(({ ageDays }) => {
    if (ageDays === undefined) return true;
    const tier = freshnessForAge(ageDays);
    return tier === "stale" || tier === "expired";
  });
  const undatedAttention = attention.filter((row) => row.ageDays === undefined).length;
  const staleAttention = attention.length - undatedAttention;

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-cocoa-900">Asks</h3>
        <p className="text-xs text-cocoa-400">
          {dated} dated · {rows.length - dated} undated
        </p>
      </div>

      {attention.length > 0 && (
        <p className="mb-3 text-sm text-amber-800">
          {attention.length} {attention.length === 1 ? "needs" : "need"} attention:{" "}
          {[
            staleAttention > 0 && `${staleAttention} over 30 days old`,
            undatedAttention > 0 && `${undatedAttention} with no date`,
          ].filter(Boolean).join(", ")}
          .{!IS_STATIC && " Check each price below."}{" "}
          <a href={`#ask-${attention[0].index}`} className="font-medium text-azalea-700 hover:underline">Go to first</a>
        </p>
      )}

      {!IS_STATIC ? <ListingEditor watchId={watch.id} watchLabel={`${watch.brand} ${watch.model}`} links={watch.links} condition={condition} /> : <p className="mb-3 text-xs text-cocoa-500">Published view · read-only. Manage listings in your local Vitrine app.</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-cocoa-500">No retailer links recorded yet.</p>
      ) : (
        <ul className="divide-y divide-cocoa-100">
          {sorted.map(({ link, ageDays, index }) => (
            <li key={`${link.url}-${index}`} id={`ask-${index}`} className="scroll-mt-6 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-medium text-azalea-700 hover:underline"
                >
                  {link.retailer || hostname(link.url)}
                </a>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {link.condition ? (
                    <span className="rounded bg-cocoa-100 px-2 py-0.5 text-xs capitalize text-cocoa-600">{link.condition}</span>
                  ) : (
                    <span className="text-xs text-cocoa-400">condition unknown</span>
                  )}
                  {link.observedAt ? (
                    <span className="text-xs text-cocoa-400">{formatDate(link.observedAt)}</span>
                  ) : (
                    <span className="text-xs text-amber-800">no date · excluded from estimates</span>
                  )}
                  {ageDays !== undefined && <FreshnessBadge tier={freshnessForAge(ageDays)} />}
                  <span className="font-semibold tabular-nums">{formatMoney(link.price)}</span>
                </div>
              </div>
              <AskTrail link={link} />
              {eligibility[index].reasons.length > 0 && <p className="mt-2 text-xs text-cocoa-500">For the {condition} estimate: {eligibility[index].reasons.join(". ")}.</p>}
              {!IS_STATIC && (
                <div className="flex flex-wrap items-start gap-x-4">
                  <ListingCheck watchId={watch.id} watchLabel={`${watch.brand} ${watch.model}`} links={watch.links} link={link} condition={condition} />
                  <ListingEditor watchId={watch.id} watchLabel={`${watch.brand} ${watch.model}`} links={watch.links} condition={condition} initial={link} label="Edit listing" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-1 border-t border-cocoa-100 pt-3">
        <ConditionEvidenceLine watch={watch} condition="new" />
        <ConditionEvidenceLine watch={watch} condition="pre-owned" />
        <p className="pt-1 text-xs text-cocoa-400">
          Asking prices are signals, not completed sales. Conditions are never pooled, and repeated links from one seller count once.
        </p>
      </div>
    </section>
  );
}

/**
 * Per condition, never pooled, for the same reason as the asks: a pre-owned
 * sale says little about what a new one fetches. A condition with no sales
 * gets no line rather than a permanent "0 recorded".
 */
function SoldSummaryLine({ watch, condition }: { watch: Watch; condition: Condition }) {
  const summary = soldCompSummary(watch, condition);
  if (summary.comps.length === 0) return null;
  const label = condition === "new" ? "New" : "Pre-owned";
  return (
    <p className="text-xs text-cocoa-500">
      <span className="font-medium text-cocoa-600">{label}:</span>{" "}
      {summary.medianUsd === undefined || summary.lowUsd === undefined || summary.highUsd === undefined
        ? "1 of 2 sales needed for a median"
        : `median ${usd(summary.medianUsd)} · range ${usd(summary.lowUsd)}–${usd(summary.highUsd)} from ${summary.comps.length} sales`}
    </p>
  );
}

function Solds({ watch }: { watch: Watch }) {
  const comps = soldComps(watch);

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-cocoa-900">Solds</h3>
        {!IS_STATIC && <AddSoldComp watchId={watch.id} watchLabel={`${watch.brand} ${watch.model}`} />}
      </div>

      {comps.length === 0 ? (
        <p className="text-sm text-cocoa-500">
          No completed sales recorded. Vitrine never scrapes or estimates sold prices, so this stays empty until you add one
          with its source and date.
        </p>
      ) : (
        <ul className="divide-y divide-cocoa-100">
          {comps.map((comp) => (
            <li key={comp.index} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 truncate font-medium text-cocoa-700">
                {comp.url ? (
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-azalea-700 hover:underline">
                    {comp.source} ↗
                  </a>
                ) : (
                  comp.source
                )}
                {comp.notes && <span className="ml-2 text-xs font-normal text-cocoa-400">{comp.notes}</span>}
              </span>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded bg-cocoa-100 px-2 py-0.5 text-xs capitalize text-cocoa-600">{comp.condition}</span>
                <span className="text-xs text-cocoa-400">
                  {formatDate(comp.soldAt)}
                  {comp.ageDays !== undefined && ` · ${formatAgeDays(comp.ageDays)}`}
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(comp.price)}</span>
                {!IS_STATIC && watch.soldComps?.[comp.index] && <RemoveSoldComp watchId={watch.id} comp={watch.soldComps[comp.index]} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-1 border-t border-cocoa-100 pt-3">
        <SoldSummaryLine watch={watch} condition="new" />
        <SoldSummaryLine watch={watch} condition="pre-owned" />
        {/* Stated on the panel, not just in the code: a reader who sees solds and
            a deal percentage together will otherwise assume one fed the other. */}
        <p className="text-xs text-cocoa-400">
          Recorded by hand, for context. Solds do not feed the fair asking range or the deal comparison, which compare asks
          with asks.
        </p>
      </div>
    </section>
  );
}

export default function MarketChapter({ watch, alertState }: { watch: Watch; alertState?: AlertState }) {
  return (
    <section aria-labelledby="market-heading" className="space-y-4">
      <div>
        <h2 id="market-heading" className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">
          Market
        </h2>
        <p className="mt-1 text-sm text-cocoa-500">
          What sellers are asking, what has actually sold, and how your tracked price compares.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TrackedPriceTile watch={watch} />
        <BestAskTile watch={watch} />
        <FairRangeTile watch={watch} />
      </div>

      <Asks watch={watch} />
      <Solds watch={watch} />
      <WatchAlertsCard watch={watch} state={alertState} />
    </section>
  );
}
