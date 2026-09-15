import { CURRENCIES, type Condition, type SoldComp } from "./types";
import { todayInputDate } from "./listing-entry";

export interface SoldCompFields {
  amount: string;
  currency: string;
  condition: string;
  soldAt: string;
  source: string;
  url: string;
  notes: string;
}
export type SoldCompErrors = Partial<Record<keyof SoldCompFields, string>>;

/** One sale from the inline form, checked field by field so each error can sit
 * beside its input. Shared by the browser and the API. Every field but url and
 * notes is required, matching cleanSoldComps in validation.ts. */
export function parseSoldCompFields(input: unknown, now = new Date()):
  | { ok: true; comp: SoldComp }
  | { ok: false; errors: SoldCompErrors } {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const text = (key: keyof SoldCompFields) => typeof data[key] === "string" ? (data[key] as string).trim() : "";
  const raw = text("amount");
  const amount = Number(raw);
  const currency = text("currency").toUpperCase();
  const condition = text("condition");
  const day = text("soldAt");
  const source = text("source");
  const url = text("url");
  const notes = text("notes");
  const errors: SoldCompErrors = {};

  if (!raw || !Number.isFinite(amount) || amount <= 0) errors.amount = "Enter the sold price, greater than zero.";
  if (!CURRENCIES.includes(currency)) errors.currency = "Choose a supported currency.";
  if (condition !== "new" && condition !== "pre-owned") errors.condition = "Choose the condition it sold in.";
  // Noon UTC keeps this calendar day in the local date display, as for asks.
  const soldAt = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(soldAt.getTime()) || soldAt.toISOString().slice(0, 10) !== day) {
    errors.soldAt = "Enter the date it sold.";
  } else if (day > todayInputDate(now)) {
    errors.soldAt = "A completed sale can't be dated in the future.";
  }
  if (!source) errors.source = "Enter where you saw the sale.";
  if (url) {
    try {
      if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
    } catch { errors.url = "Enter a full http or https link, or leave it empty."; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const comp: SoldComp = { price: { amount, currency }, condition: condition as Condition, soldAt: soldAt.toISOString(), source };
  if (url) comp.url = url;
  if (notes) comp.notes = notes;
  return { ok: true, comp };
}

/** Identifies the stored sale a Remove refers to, independent of list order,
 * so removing from a stale page can't delete a different sale. */
export function soldCompRevision(comp: SoldComp): string {
  return JSON.stringify([comp.price.amount, comp.price.currency, comp.condition, comp.soldAt, comp.source, comp.url ?? "", comp.notes ?? ""]);
}
