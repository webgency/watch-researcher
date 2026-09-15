import {
  ALERT_TYPES,
  PRICE_DROP_THRESHOLD,
  isTypeEnabled,
  watchesForFreshOffers,
  type AlertEvent,
  type AlertState,
  type AlertType,
} from "./alerts.mjs";
import { normalizeMoneyToUsd } from "./offer-signals.mjs";
import { formatMoney } from "./format";
import { WISHLIST_TIER_LABELS, type Watch } from "./types";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  target_met: "Target met",
  price_drop: "Price drop",
  fresh_offer: "Fresh offer",
};

export interface AlertTypeStatus {
  type: AlertType;
  watching: boolean;
  /** Why, in the reader's terms: what is watched, or which input rules it out. */
  detail: string;
}

export interface WatchAlertStatus {
  muted: boolean;
  types: AlertTypeStatus[];
  /** Newest recorded alert for this watch, whether or not it is currently shown. */
  lastEvent?: AlertEvent;
}

/**
 * What a write to this watch could announce, per type, and why not when it
 * can't. Mirrors the gates in detectAlerts() and appendAlerts() in alerts.mjs:
 * change one and the other must follow. A status that says "watching" for a
 * type the detector skips would promise news that never arrives.
 */
export function watchAlertStatus(watch: Watch, state: AlertState): WatchAlertStatus {
  const muted = state.muted.includes(watch.id);
  const types = ALERT_TYPES.map((type): AlertTypeStatus => {
    if (!isTypeEnabled(state, type)) return { type, watching: false, detail: "Off for every watch in alert settings" };
    const status = typeGate(watch, type);
    if (muted && status.watching) return { type, watching: false, detail: "Paused while this watch is muted" };
    return status;
  });
  const lastEvent = [...state.events].reverse().find((event) => event.watchId === watch.id);
  return { muted, types, lastEvent };
}

function typeGate(watch: Watch, type: AlertType): AlertTypeStatus {
  if (type === "target_met") {
    if (!watch.targetPrice) return { type, watching: false, detail: "No target set" };
    if (normalizeMoneyToUsd(watch.targetPrice) === undefined) {
      return { type, watching: false, detail: "The target's currency can't be compared" };
    }
    return { type, watching: true, detail: `Watching · target ${formatMoney(watch.targetPrice)}` };
  }

  if (type === "price_drop") {
    const priced = watch.links.filter((link) => link.price).length;
    if (!priced) return { type, watching: false, detail: "No priced listings to watch" };
    return {
      type,
      watching: true,
      detail: `Watching ${priced} ${priced === 1 ? "listing" : "listings"} · fires ${PRICE_DROP_THRESHOLD * 100}% below a listing's high`,
    };
  }

  if (watch.status !== "wishlist") return { type, watching: false, detail: "Only for wishlist watches" };
  if (!watchesForFreshOffers(watch)) {
    return { type, watching: false, detail: `Not for this watch · marked ${WISHLIST_TIER_LABELS[watch.wishlistTier ?? "watching"]}` };
  }
  return { type, watching: true, detail: "Watching · new dated asks, or stale ones confirmed again" };
}
