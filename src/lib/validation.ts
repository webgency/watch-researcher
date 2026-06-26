import { SPEC_FIELDS } from "./specs";
import {
  CURRENCIES,
  Condition,
  Money,
  MOVEMENT_TYPES,
  RetailerLink,
  Watch,
  WatchInput,
  WatchSpecs,
  WatchStatus,
  WATCH_STATUSES,
  WishlistTier,
  WISHLIST_TIERS,
} from "./types";

type RecordValue = Record<string, unknown>;

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export class DataValidationError extends Error {
  constructor(message: string, readonly errors: string[]) {
    super(message);
    this.name = "DataValidationError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanOptionalString(value: unknown, path: string, errors: string[]): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return undefined;
  }
  return value.trim() || undefined;
}

function cleanRequiredString(value: unknown, path: string, errors: string[]): string | undefined {
  const cleaned = cleanOptionalString(value, path, errors);
  if (!cleaned) errors.push(`${path} is required`);
  return cleaned;
}

function cleanPositiveNumber(value: unknown, path: string, errors: string[]): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    errors.push(`${path} must be a positive number`);
    return undefined;
  }
  return number;
}

function cleanCurrency(value: unknown, path: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path} is required`);
    return undefined;
  }
  const currency = value.trim().toUpperCase();
  if (!CURRENCIES.includes(currency)) {
    errors.push(`${path} must be one of ${CURRENCIES.join(", ")}`);
    return undefined;
  }
  return currency;
}

function cleanMoney(value: unknown, path: string, errors: string[]): Money | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const amount = cleanPositiveNumber(value.amount, `${path}.amount`, errors);
  const currency = cleanCurrency(value.currency, `${path}.currency`, errors);
  return amount !== undefined && currency ? { amount, currency } : undefined;
}

function cleanStatus(value: unknown, required: boolean, errors: string[]): WatchStatus | undefined {
  if (value === undefined || value === null || value === "") {
    return required ? "wishlist" : undefined;
  }
  if (typeof value !== "string" || !WATCH_STATUSES.includes(value as WatchStatus)) {
    errors.push(`status must be one of ${WATCH_STATUSES.join(", ")}`);
    return undefined;
  }
  return value as WatchStatus;
}

function cleanWishlistTier(value: unknown, errors: string[]): WishlistTier | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !WISHLIST_TIERS.includes(value as WishlistTier)) {
    errors.push(`wishlistTier must be one of ${WISHLIST_TIERS.join(", ")}`);
    return undefined;
  }
  return value as WishlistTier;
}

function cleanCondition(value: unknown, path: string, errors: string[]): Condition | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value !== "new" && value !== "pre-owned") {
    errors.push(`${path} must be new or pre-owned`);
    return undefined;
  }
  return value;
}

function cleanLinks(value: unknown, required: boolean, errors: string[]): RetailerLink[] | undefined {
  if (value === undefined || value === null) return required ? [] : undefined;
  if (!Array.isArray(value)) {
    errors.push("links must be an array");
    return undefined;
  }

  return value.flatMap((item, index) => {
    const path = `links[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} must be an object`);
      return [];
    }

    const url = cleanRequiredString(item.url, `${path}.url`, errors);
    if (!url) return [];

    const link: RetailerLink = { url };
    const retailer = cleanOptionalString(item.retailer, `${path}.retailer`, errors);
    const price = cleanMoney(item.price, `${path}.price`, errors);
    const condition = cleanCondition(item.condition, `${path}.condition`, errors);

    if (retailer) link.retailer = retailer;
    if (price) link.price = price;
    if (condition) link.condition = condition;
    return [link];
  });
}

function cleanSpecs(value: unknown, required: boolean, errors: string[]): WatchSpecs | undefined {
  if (value === undefined || value === null) return required ? {} : undefined;
  if (!isRecord(value)) {
    errors.push("specs must be an object");
    return undefined;
  }

  const specs: WatchSpecs = {};
  for (const field of SPEC_FIELDS) {
    const raw = value[field.key];
    if (raw === undefined || raw === null || raw === "") continue;

    if (field.type === "number") {
      const number = cleanPositiveNumber(raw, `specs.${String(field.key)}`, errors);
      if (number !== undefined) (specs[field.key] as number) = number;
      continue;
    }

    const text = cleanOptionalString(raw, `specs.${String(field.key)}`, errors);
    if (!text) continue;

    if (field.key === "movement" && !MOVEMENT_TYPES.includes(text as typeof MOVEMENT_TYPES[number])) {
      errors.push(`specs.movement must be one of ${MOVEMENT_TYPES.join(", ")}`);
      continue;
    }

    (specs[field.key] as string) = text;
  }
  return specs;
}

function cleanTags(value: unknown, required: boolean, errors: string[]): string[] | undefined {
  if (value === undefined || value === null) return required ? [] : undefined;
  if (!Array.isArray(value)) {
    errors.push("tags must be an array");
    return undefined;
  }

  const tags: string[] = [];
  value.forEach((item, index) => {
    const tag = cleanOptionalString(item, `tags[${index}]`, errors);
    if (tag) tags.push(tag);
  });
  return Array.from(new Set(tags));
}

function cleanDateString(value: unknown, path: string, errors: string[]): string | undefined {
  const date = cleanOptionalString(value, path, errors);
  if (!date) return undefined;
  if (Number.isNaN(new Date(date).getTime())) {
    errors.push(`${path} must be a valid date`);
    return undefined;
  }
  return date;
}

function cleanTransaction(
  value: unknown,
  path: string,
  errors: string[]
): { price?: Money; date?: string } | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const price = cleanMoney(value.price, `${path}.price`, errors);
  const date = cleanDateString(value.date, `${path}.date`, errors);
  return price || date ? { ...(price ? { price } : {}), ...(date ? { date } : {}) } : undefined;
}

function assignIfPresent<T extends RecordValue, K extends keyof WatchInput>(
  target: Partial<WatchInput>,
  source: T,
  key: string,
  value: WatchInput[K] | undefined
) {
  if (hasOwn(source, key)) {
    (target as Record<string, unknown>)[key] = value;
  }
}

export function normalizeWatchInput(body: unknown): ValidationResult<WatchInput> {
  return normalizeWatchShape(body, false) as ValidationResult<WatchInput>;
}

export function normalizeWatchPatch(body: unknown): ValidationResult<Partial<WatchInput>> {
  return normalizeWatchShape(body, true);
}

function normalizeWatchShape(
  body: unknown,
  partial: boolean
): ValidationResult<WatchInput | Partial<WatchInput>> {
  const errors: string[] = [];
  if (!isRecord(body)) return { ok: false, errors: ["body must be an object"] };

  const output: Partial<WatchInput> = {};

  if (!partial || hasOwn(body, "brand")) {
    assignIfPresent(output, body, "brand", cleanRequiredString(body.brand, "brand", errors));
  }
  if (!partial || hasOwn(body, "model")) {
    assignIfPresent(output, body, "model", cleanRequiredString(body.model, "model", errors));
  }

  assignIfPresent(output, body, "referenceNumber", cleanOptionalString(body.referenceNumber, "referenceNumber", errors));
  assignIfPresent(output, body, "status", cleanStatus(body.status, !partial, errors));
  assignIfPresent(output, body, "wishlistTier", cleanWishlistTier(body.wishlistTier, errors));
  assignIfPresent(output, body, "price", cleanMoney(body.price, "price", errors));
  assignIfPresent(output, body, "priceUpdatedAt", cleanDateString(body.priceUpdatedAt, "priceUpdatedAt", errors));
  assignIfPresent(output, body, "links", cleanLinks(body.links, !partial, errors));
  assignIfPresent(output, body, "imageUrl", cleanOptionalString(body.imageUrl, "imageUrl", errors));
  assignIfPresent(output, body, "specs", cleanSpecs(body.specs, !partial, errors));
  assignIfPresent(output, body, "tags", cleanTags(body.tags, !partial, errors));
  assignIfPresent(output, body, "notes", cleanOptionalString(body.notes, "notes", errors));
  assignIfPresent(output, body, "purchase", cleanTransaction(body.purchase, "purchase", errors));
  assignIfPresent(output, body, "sale", cleanTransaction(body.sale, "sale", errors));

  if (!partial) {
    output.brand ??= "";
    output.model ??= "";
    output.status ??= "wishlist";
    output.links ??= [];
    output.specs ??= {};
    output.tags ??= [];
  }

  return errors.length ? { ok: false, errors } : { ok: true, data: output as WatchInput | Partial<WatchInput> };
}

export function validateWatchCollection(value: unknown): Watch[] {
  if (!Array.isArray(value)) {
    throw new DataValidationError("Watch data must be an array.", ["data/watches.json must contain an array"]);
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  const watches: Watch[] = [];

  value.forEach((item, index) => {
    const path = `watches[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} must be an object`);
      return;
    }

    const id = cleanRequiredString(item.id, `${path}.id`, errors);
    if (id) {
      if (ids.has(id)) errors.push(`${path}.id duplicates ${id}`);
      ids.add(id);
    }

    const dateAdded = cleanDateString(item.dateAdded, `${path}.dateAdded`, errors);
    const result = normalizeWatchInput(item);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `${path}.${error}`));
      return;
    }
    if (id && dateAdded) {
      watches.push({ ...result.data, id, dateAdded });
    }
  });

  if (errors.length) {
    throw new DataValidationError("Watch data is invalid.", errors);
  }

  return watches;
}
