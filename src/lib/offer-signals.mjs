import { CURRENCY_TO_USD } from "./currency-rates.mjs";

export const FRESHNESS_MAX_AGE_DAYS = {
  fresh: 7,
  aging: 30,
  stale: 90,
};

export function normalizeMoneyToUsd(money) {
  if (!money || typeof money.amount !== "number" || !Number.isFinite(money.amount)) return undefined;
  const currency = String(money.currency ?? "").trim().toUpperCase();
  const rate = CURRENCY_TO_USD[currency];
  return rate === undefined ? undefined : money.amount * rate;
}

/** Whole days since an observation, clamped at zero for future-dated records. */
export function observationAgeDays(observedAt, now = new Date()) {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return undefined;
  return Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000));
}

export function freshnessForAge(ageDays) {
  if (ageDays <= FRESHNESS_MAX_AGE_DAYS.fresh) return "fresh";
  if (ageDays <= FRESHNESS_MAX_AGE_DAYS.aging) return "aging";
  if (ageDays <= FRESHNESS_MAX_AGE_DAYS.stale) return "stale";
  return "expired";
}

export function freshnessForAges(ages) {
  if (!ages.length) return undefined;
  return freshnessForAge(Math.max(...ages));
}

function sourceKey(link) {
  try {
    return new URL(link.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return (link.retailer || link.url).trim().toLowerCase();
  }
}

/** Infer the tracked headline condition only from a link carrying that price. */
export function trackedAskCondition(watch) {
  if (watch.price) {
    const matches = (watch.links ?? [])
      .filter((link) =>
        link.condition !== undefined &&
        link.price?.amount === watch.price?.amount &&
        link.price?.currency === watch.price?.currency
      )
      .sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? ""));
    if (matches[0]?.condition) return matches[0].condition;
  }
  return "new";
}

/**
 * Lowest dated retailer ask, preferring the tracked/deal condition. Every
 * candidate comes directly from links[]; the headline price is never injected.
 */
export function bestDatedOffer(
  watch,
  preferredCondition = trackedAskCondition(watch),
  now = new Date(),
) {
  let undatedOfferCount = 0;
  const offers = [];

  for (const link of watch.links ?? []) {
    if (!link.price) continue;
    if (!link.observedAt) {
      undatedOfferCount += 1;
      continue;
    }
    const ageDays = observationAgeDays(link.observedAt, now);
    const priceUsd = normalizeMoneyToUsd(link.price);
    if (ageDays === undefined || priceUsd === undefined) continue;
    offers.push({
      price: link.price,
      priceUsd,
      url: link.url,
      source: link.retailer?.trim() || sourceKey(link),
      condition: link.condition,
      observedAt: link.observedAt,
      ageDays,
      freshness: freshnessForAge(ageDays),
    });
  }

  if (!offers.length) {
    return {
      status: "insufficient",
      reason: "no-dated-offers",
      preferredCondition,
      undatedOfferCount,
    };
  }

  const matching = offers.filter((offer) => offer.condition === preferredCondition);
  const eligible = matching.length ? matching : offers;
  const offer = [...eligible].sort((a, b) => a.priceUsd - b.priceUsd || a.ageDays - b.ageDays)[0];
  const conditionMatch = offer.condition === preferredCondition
    ? "matched"
    : offer.condition === undefined
      ? "unknown"
      : "fallback";

  return {
    status: "available",
    offer,
    preferredCondition,
    conditionMatch,
    usedConditionFallback: conditionMatch === "fallback",
    undatedOfferCount,
  };
}
