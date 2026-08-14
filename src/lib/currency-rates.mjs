// Currency conversion rates, in one place.
//
// Two consumers need the same table and cannot share a TypeScript module:
// scoring.ts normalizes prices to USD for banding and value scoring, and
// scripts/validate-data.mjs warns about a currency the scoring engine cannot
// convert. Plain .mjs is the format both can import, matching ./spec-ranges.mjs.
//
// SNAPSHOT, NOT A FEED. These were taken from the ECB reference rates for
// 2026-08-13 (via api.frankfurter.dev), cross-checked against
// open.er-api.com for 2026-08-14; the two agreed to within 0.1%. They drift,
// and nothing in the app refreshes them. Prices stored in a foreign currency
// are therefore scored at the rate below, not at today's — which matters
// because a few percent can move a watch across a price band and change the
// rubric it is judged against.
//
// To refresh:
//   curl -s "https://api.frankfurter.dev/v1/latest?base=USD"
// then invert each quote (the API gives units per USD; this table is USD per
// unit) and update RATES_AS_OF below.

/** The date the rates below were taken, for display and staleness checks. */
export const RATES_AS_OF = "2026-08-13";

/**
 * How old the snapshot may get before validate:data complains.
 *
 * Chosen against the failure that actually matters: not that a price is a few
 * dollars off, but that drift moves a watch across a price band and changes the
 * rubric it is judged by. The bands are hundreds of dollars wide, so it takes a
 * multi-percent move to cross one — a quarter's drift on a major pair, roughly.
 * Shorter would cry wolf; much longer and a band could shift unnoticed.
 */
export const RATES_STALE_AFTER_DAYS = 90;

/** Whole days between RATES_AS_OF and `now`. Negative if the date is in the future. */
export function ratesAgeDays(now = new Date()) {
  const takenAt = new Date(`${RATES_AS_OF}T00:00:00Z`);
  if (Number.isNaN(takenAt.getTime())) return undefined;
  return Math.floor((now.getTime() - takenAt.getTime()) / 86_400_000);
}

/** True once the snapshot is older than RATES_STALE_AFTER_DAYS. */
export function ratesAreStale(now = new Date()) {
  const age = ratesAgeDays(now);
  return age !== undefined && age > RATES_STALE_AFTER_DAYS;
}

/**
 * USD value of one unit of each currency. Every currency offered by the entry
 * form (CURRENCIES in types.ts) must appear here — a missing entry falls back
 * to a 1.0 rate, which silently scores e.g. 3000 SEK as $3000.
 */
export const CURRENCY_TO_USD = {
  USD: 1.0,
  EUR: 1.1534,
  GBP: 1.3492,
  CHF: 1.2306,
  JPY: 0.006276,
  AUD: 0.7052,
  CAD: 0.7169,
  SGD: 0.7812,
  SEK: 0.10458,
  NOK: 0.10499,
  DKK: 0.15429,
  HKD: 0.12744,
  NZD: 0.58445,
};
