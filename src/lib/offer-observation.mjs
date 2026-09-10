/**
 * Record a retailer ask on the exact link that produced it.
 *
 * Unlike priceHistory, which records price moves, a link's observedAt is the
 * last time that retailer's ask was successfully confirmed. Re-reading the
 * same amount therefore advances observedAt: freshness answers "how recently
 * did we verify this listing?", not "when did this price first appear?".
 *
 * A currency change is a change of units, not necessarily a price move. Keep
 * the existing observation intact unless the caller explicitly opts in.
 *
 * @param {{ price?: { amount: number, currency: string }, observedAt?: string }} link
 * @param {{ amount: number, currency: string }} price
 * @param {string} observedAt
 * @param {{ allowCurrencyChange?: boolean }} [options]
 * @returns {"updated" | "currency"}
 */
export function recordOfferObservation(link, price, observedAt, options = {}) {
  if (
    link.price &&
    link.price.currency !== price.currency &&
    !options.allowCurrencyChange
  ) {
    return "currency";
  }

  link.price = price;
  link.observedAt = observedAt;
  return "updated";
}
