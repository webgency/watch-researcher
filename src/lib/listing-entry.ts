import { CURRENCIES, type Condition, type Money, type RetailerLink } from "./types";
import { normalizeMoneyToUsd } from "./offer-signals.mjs";
import { marketSourceKey, observationAgeDays } from "./valuation";

export interface ListingFields {
  url: string;
  amount: string;
  currency: string;
  condition: string;
  observedAt: string;
}
export type ListingErrors = Partial<Record<keyof ListingFields, string>>;

/** The focused editor accepts only listing fields, never a watch-wide patch
 * or caller-supplied history. Shared by the browser and the API. */
export function parseListingFields(input: unknown):
  | { ok: true; listing: RetailerLink }
  | { ok: false; errors: ListingErrors } {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const text = (key: keyof ListingFields) => typeof data[key] === "string" ? (data[key] as string).trim() : "";
  const url = text("url");
  const currency = text("currency").toUpperCase();
  const condition = text("condition");
  const day = text("observedAt");
  const amount = Number(text("amount"));
  const errors: ListingErrors = {};
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
  } catch { errors.url = "Enter a full http or https listing URL."; }
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Enter the asking price you saw, greater than zero.";
  if (!CURRENCIES.includes(currency)) errors.currency = "Choose a supported currency.";
  if (condition !== "new" && condition !== "pre-owned") errors.condition = "Choose the listing's condition.";
  // Noon UTC preserves this calendar day in the local date display. A date is
  // never invented just because a price was typed; the user supplies it.
  const observed = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(observed.getTime()) || observed.toISOString().slice(0, 10) !== day) {
    errors.observedAt = "Enter the date you saw this price.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, listing: { url, retailer: marketSourceKey({ url }), price: { amount, currency }, condition: condition as Condition, observedAt: observed.toISOString() } };
}

/** Ignore fragments and URL spelling normalized by the URL parser when
 * checking a duplicate, but retain query parameters that may identify an item. */
export function listingIdentity(url: string): string {
  try { const parsed = new URL(url.trim()); parsed.hash = ""; return parsed.href; }
  catch { return url.trim(); }
}

/** A focused edit must not overwrite a newer edit to this same listing. The
 * stable field order is independent of JSON key order in the collection. */
export function listingRevision(link: RetailerLink): string {
  return JSON.stringify([link.url, link.retailer ?? "", link.price?.amount ?? null, link.price?.currency ?? "", link.condition ?? "", link.observedAt ?? "", link.askHistory ?? []]);
}

/** The browser's own calendar day, the value a date input shows for "today". */
export function todayInputDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export type ListingCheckOutcome =
  | { kind: "no-price" }
  | { kind: "unchanged"; price: Money; missingCondition: boolean }
  | { kind: "changed"; price: Money; currencyChanged: boolean; missingCondition: boolean };

/**
 * Compare a re-fetched retailer page with one recorded listing. Only the price
 * is read from the page: brand, image and specs belong to "Refresh watch
 * details", and a scraped condition is not trusted to overwrite a recorded one.
 * Nothing is saved here; the caller shows the outcome for review first.
 */
export function listingCheckOutcome(link: RetailerLink, scraped: { price?: Partial<Money> } | undefined): ListingCheckOutcome {
  const amount = scraped?.price?.amount;
  const currency = scraped?.price?.currency?.toUpperCase();
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || !currency) return { kind: "no-price" };
  const price = { amount, currency };
  const missingCondition = !link.condition;
  if (link.price && link.price.currency.toUpperCase() === currency && link.price.amount === amount) {
    return { kind: "unchanged", price, missingCondition };
  }
  // A currency switch restarts the ask trail in the store rather than
  // comparing through a rate snapshot, so the reviewer is told as much.
  return { kind: "changed", price, currencyChanged: Boolean(link.price) && link.price!.currency.toUpperCase() !== currency, missingCondition };
}

export function listingEligibility(links: RetailerLink[], condition: Condition, now = new Date()) {
  const rows = links.map((link) => {
    const reasons: string[] = [];
    const price = normalizeMoneyToUsd(link.price);
    if (price === undefined || price <= 0) reasons.push("Missing or unsupported price");
    if (!link.observedAt || observationAgeDays(link.observedAt, now) === undefined) reasons.push("Missing or invalid observation date");
    if (!link.condition) reasons.push("Condition not recorded");
    else if (link.condition !== condition) reasons.push(`${link.condition === "new" ? "New" : "Pre-owned"} listing; this estimate uses ${condition} asks`);
    return { link, reasons };
  });
  const latest = new Map<string, number>();
  rows.forEach(({ link, reasons }, index) => {
    if (reasons.length) return;
    const key = marketSourceKey(link);
    const previous = latest.get(key);
    // Match Market's latest observation per source, including its stable tie
    // behavior. Different listings on one site must not promise two sources.
    if (previous === undefined || new Date(rows[previous].link.observedAt!).getTime() < new Date(link.observedAt!).getTime()) latest.set(key, index);
  });
  rows.forEach(({ link, reasons }, index) => {
    if (!reasons.length && latest.get(marketSourceKey(link)) !== index) reasons.push("This site already counts once; its latest dated listing is used");
  });
  return rows;
}
