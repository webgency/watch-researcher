// Per-listing ask history: how one retailer URL's ask has moved over time.
//
// Plain .mjs because two writers need the same rule and can't share a
// TypeScript module: the app's store (form and API edits) and
// scripts/enrich-watches.mjs, which runs under bare Node with no build step.
//
// Same rule as a watch's priceHistory: the series records moves, not polls.
// Re-reading an unchanged ask adds nothing, so every consecutive pair differs
// and each date means "at this ask since". That is deliberately different from
// the link's observedAt, which advances on every confirmation and answers "how
// recently did we verify this listing?".

/** @typedef {{ amount: number, currency: string }} Money */
/** @typedef {{ price: Money, date: string, source?: string }} AskSnapshot */
/** @typedef {{ url: string, price?: Money, observedAt?: string, askHistory?: AskSnapshot[] }} Link */

function sameCurrency(a, b) {
  return a.currency.trim().toUpperCase() === b.currency.trim().toUpperCase();
}

function sameMoney(a, b) {
  return a.amount === b.amount && sameCurrency(a, b);
}

/**
 * Record `next`'s ask on its history when it moved from `previous`, the same
 * link as it stood before this update. Mutates and returns `next`.
 *
 * - Unchanged ask, or no prior ask: the prior history is carried over as-is.
 * - First move: seeded with the prior ask at its observedAt, so the trail
 *   shows what it moved from. An undated prior ask is not seeded; a trail
 *   starting at an invented date would be worse than no trail yet.
 * - Currency change: the trail restarts. Amounts in two currencies can only be
 *   compared through a rate snapshot, which would show a move nobody made.
 *
 * @template {Link} T
 * @param {Link | undefined} previous
 * @param {T} next
 * @param {string} now ISO timestamp used when the update carries no new date
 * @param {string} [source]
 * @returns {T & { askHistory?: AskSnapshot[] }}
 */
export function recordAskMove(previous, next, now, source) {
  const prior = previous?.askHistory?.length ? previous.askHistory : undefined;

  if (!next.price || !previous?.price || sameMoney(previous.price, next.price)) {
    if (prior) next.askHistory = prior;
    return next;
  }
  if (!sameCurrency(previous.price, next.price)) {
    delete next.askHistory;
    return next;
  }

  let history = prior;
  if (!history) {
    if (!previous.observedAt) return next;
    history = [{ price: previous.price, date: previous.observedAt }];
  }

  // A form edit that changes the price without touching the date keeps the
  // old observedAt; that date belongs to the old ask, so the move is dated now.
  // Never date a move before the entry it follows.
  const last = history[history.length - 1];
  let date = next.observedAt && next.observedAt !== previous.observedAt ? next.observedAt : now;
  if (new Date(date).getTime() < new Date(last.date).getTime()) date = now;

  /** @type {AskSnapshot} */
  const snapshot = { price: next.price, date };
  if (source) snapshot.source = source;
  next.askHistory = [...history, snapshot];
  return next;
}

/**
 * Apply recordAskMove across a whole links update, matching links by URL.
 *
 * Callers that rebuild links from their own fields (the watch form) never send
 * askHistory, so without this every save would erase the trails. A link that
 * does arrive with its own askHistory, from an importer, is left alone, the
 * same way updateWatch leaves an explicit priceHistory alone.
 *
 * @template {Link} T
 * @param {Link[] | undefined} existingLinks
 * @param {T[]} nextLinks
 * @param {string} now
 * @param {string} [source]
 * @returns {Array<T & { askHistory?: AskSnapshot[] }>}
 */
export function carryAskHistories(existingLinks, nextLinks, now, source) {
  const byUrl = new Map((existingLinks ?? []).map((link) => [link.url.trim(), link]));
  return nextLinks.map((link) => {
    if (Object.prototype.hasOwnProperty.call(link, "askHistory")) return link;
    return recordAskMove(byUrl.get(link.url.trim()), { ...link }, now, source);
  });
}
