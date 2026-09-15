import { CURRENCIES, type Money } from "./types";

export interface TargetFields {
  amount: string;
  currency: string;
}
export type TargetErrors = Partial<Record<keyof TargetFields, string>>;

/** The inline target editor sends only these two fields, never a watch patch.
 * Shared by the browser and the API. Clearing is a separate, explicit request,
 * so an emptied amount is an error rather than a silent removal. */
export function parseTargetFields(input: unknown):
  | { ok: true; target: Money }
  | { ok: false; errors: TargetErrors } {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const text = (key: keyof TargetFields) => typeof data[key] === "string" ? (data[key] as string).trim() : "";
  const raw = text("amount");
  const amount = Number(raw);
  const currency = text("currency").toUpperCase();
  const errors: TargetErrors = {};
  if (!raw || !Number.isFinite(amount) || amount <= 0) errors.amount = "Enter the price you'd pay, greater than zero.";
  if (!CURRENCIES.includes(currency)) errors.currency = "Choose a supported currency.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, target: { amount, currency } };
}

/** A stale draft must not overwrite a target changed in another tab or form. */
export function targetRevision(target?: Money): string {
  return JSON.stringify([target?.amount ?? null, target?.currency ?? ""]);
}
