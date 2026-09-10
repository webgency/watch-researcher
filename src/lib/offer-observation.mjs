/**
 * Record a retailer ask on the exact link that produced it.
 *
 * Unlike priceHistory, which records price moves, a link's observedAt is the
 * last time that retailer's ask was successfully confirmed. Re-reading the
 * same amount therefore advances observedAt: freshness answers "how recently
 * did we verify this listing?", not "when did this price first appear?".
 *
 * Retailer asks are stored in the currency the page actually stated. Existing
 * USD conversions may therefore be replaced by native money; valuation uses
 * the shared rate snapshot to normalize it without inventing a live FX quote.
 *
 * @param {{ price?: { amount: number, currency: string }, observedAt?: string, condition?: "new" | "pre-owned" }} link
 * @param {{ amount: number, currency: string }} price
 * @param {string} observedAt
 * @param {{ condition?: "new" | "pre-owned" }} [options]
 * @returns {"updated" | "currency-updated"}
 */
export function recordOfferObservation(link, price, observedAt, options = {}) {
  const changedCurrency = Boolean(link.price && link.price.currency !== price.currency);
  link.price = price;
  link.observedAt = observedAt;
  if (!link.condition && options.condition) link.condition = options.condition;
  return changedCurrency ? "currency-updated" : "updated";
}
