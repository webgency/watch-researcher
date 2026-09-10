import {
  bestDatedOffer,
  freshnessForAge,
  normalizeMoneyToUsd,
  observationAgeDays,
} from "./offer-signals.mjs";

export const TARGET_NOTIFICATION_MAX_AGE_DAYS = 90;

function sameMoney(left, right) {
  return Boolean(
    left && right &&
    left.amount === right.amount &&
    String(left.currency).trim().toUpperCase() === String(right.currency).trim().toUpperCase(),
  );
}

function trackedObservedAt(watch, trigger) {
  if (watch.priceUpdatedAt) return watch.priceUpdatedAt;
  if (trigger !== "tracked" || !watch.price) return undefined;
  const latest = watch.priceHistory?.[watch.priceHistory.length - 1];
  return sameMoney(latest?.price, watch.price) ? latest.date : undefined;
}

function reason(signal, code, message) {
  return { signal, code, message };
}

/**
 * Determine every target-met signal without side effects. Both retailer and
 * tracked/all-in asks need a valid date, and expired evidence is skipped unless
 * the caller explicitly opts in.
 */
export function detectTargetNotification(watch, options = {}) {
  const now = options.now ?? new Date();
  const includeStale = options.includeStale ?? false;
  const hits = [];
  const skipReasons = [];

  if (!watch.targetPrice) {
    return {
      status: "skipped",
      watchId: watch.id,
      hits,
      skipReasons: [reason("target", "no-target", "No target price is set.")],
    };
  }

  const targetUsd = normalizeMoneyToUsd(watch.targetPrice);
  if (targetUsd === undefined) {
    return {
      status: "skipped",
      watchId: watch.id,
      target: watch.targetPrice,
      hits,
      skipReasons: [reason("target", "unknown-target-currency", "The target currency cannot be normalized.")],
    };
  }

  const currentPrice = watch.landedPrice ?? watch.price;
  const currentTrigger = watch.landedPrice ? "landed" : "tracked";
  if (!currentPrice) {
    skipReasons.push(reason(currentTrigger, "missing-current-ask", "No tracked or landed ask is recorded."));
  } else {
    const currentUsd = normalizeMoneyToUsd(currentPrice);
    const observedAt = trackedObservedAt(watch, currentTrigger);
    const ageDays = observedAt ? observationAgeDays(observedAt, now) : undefined;
    if (currentUsd === undefined) {
      skipReasons.push(reason(currentTrigger, "unknown-current-currency", "The current ask currency cannot be normalized."));
    } else if (ageDays === undefined) {
      skipReasons.push(reason(currentTrigger, "undated-current-ask", "The current ask has no usable observation date."));
    } else {
      const freshness = freshnessForAge(ageDays);
      if (freshness === "expired" && !includeStale) {
        skipReasons.push(reason(currentTrigger, "expired-current-ask", "The current ask is older than 90 days."));
      } else if (currentUsd <= targetUsd) {
        hits.push({
          trigger: currentTrigger,
          basis: currentTrigger === "landed" ? "all-in" : "tracked",
          price: currentPrice,
          priceUsd: currentUsd,
          observedAt,
          ageDays,
          freshness,
        });
      } else {
        skipReasons.push(reason(currentTrigger, "current-ask-above-target", "The current ask is above target."));
      }
    }
  }

  const best = bestDatedOffer(watch, undefined, now);
  if (best.status !== "available") {
    skipReasons.push(reason("best-offer", "no-dated-offer", "No dated retailer offer is available."));
  } else if (best.offer.freshness === "expired" && !includeStale) {
    skipReasons.push(reason("best-offer", "expired-best-offer", "The best dated offer is older than 90 days."));
  } else if (best.offer.priceUsd <= targetUsd) {
    hits.push({
      trigger: "best-offer",
      basis: "listed",
      price: best.offer.price,
      priceUsd: best.offer.priceUsd,
      observedAt: best.offer.observedAt,
      ageDays: best.offer.ageDays,
      freshness: best.offer.freshness,
      source: best.offer.source,
      condition: best.offer.condition,
      url: best.offer.url,
    });
  } else {
    skipReasons.push(reason("best-offer", "best-offer-above-target", "The best dated offer is above target."));
  }

  return {
    status: hits.length ? "actionable" : "skipped",
    watchId: watch.id,
    target: watch.targetPrice,
    targetUsd,
    hits,
    skipReasons,
  };
}

export function notificationKey(watchId, hit) {
  const currency = String(hit.price.currency).trim().toUpperCase();
  return `v1:${watchId}:${hit.trigger}:${currency}:${hit.price.amount}`;
}
