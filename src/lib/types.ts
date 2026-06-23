// Core domain model for the watch tracker.

export type WatchStatus = "wishlist" | "owned" | "sold";

export type MovementType =
  | "automatic"
  | "manual"
  | "quartz"
  | "spring-drive"
  | "solar"
  | "kinetic"
  | "other";

export type Condition = "new" | "pre-owned";

export interface Money {
  amount: number;
  /** ISO 4217 currency code, e.g. "USD", "EUR", "GBP". */
  currency: string;
}

export interface RetailerLink {
  url: string;
  retailer?: string;
  price?: Money;
  condition?: Condition;
}

export interface WatchSpecs {
  caseDiameterMm?: number;
  caseThicknessMm?: number;
  lugToLugMm?: number;
  lugWidthMm?: number;
  movement?: MovementType;
  caliber?: string;
  powerReserveHours?: number;
  waterResistanceM?: number;
  crystal?: string;
  dialColor?: string;
  braceletStrap?: string;
  complications?: string;
}

export interface Watch {
  id: string;
  brand: string;
  model: string;
  referenceNumber?: string;
  status: WatchStatus;
  /** Wishlist ranking — lower number = higher priority. */
  priority?: number;
  /** Flag a dream/"grail" watch. */
  grail?: boolean;
  /** Headline price you're tracking (usually the best/target price). */
  price?: Money;
  /** ISO timestamp of when `price` was last refreshed (set by the enrich script). */
  priceUpdatedAt?: string;
  links: RetailerLink[];
  imageUrl?: string;
  specs: WatchSpecs;
  tags: string[];
  notes?: string;
  /** ISO timestamp set when the watch is first added. */
  dateAdded: string;
  /** Filled in when status becomes "owned". */
  purchase?: { price?: Money; date?: string };
  /** Filled in when status becomes "sold". */
  sale?: { price?: Money; date?: string };
}

/** Shape accepted when creating a watch (id + dateAdded are assigned by the store). */
export type WatchInput = Omit<Watch, "id" | "dateAdded">;

export const WATCH_STATUSES: WatchStatus[] = ["wishlist", "owned", "sold"];

export const MOVEMENT_TYPES: MovementType[] = [
  "automatic",
  "manual",
  "quartz",
  "spring-drive",
  "solar",
  "kinetic",
  "other",
];

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "SGD"];
