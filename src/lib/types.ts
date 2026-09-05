// Core domain model for the watch tracker.

export type WatchStatus = "wishlist" | "owned" | "sold";

export type WishlistTier =
  | "next-purchase"
  | "must-have"
  | "love-it"
  | "interested"
  | "maybe-later"
  | "pass";

export type MovementType =
  | "automatic"
  | "manual"
  | "quartz"
  | "spring-drive"
  | "solar"
  | "kinetic"
  | "other";

export type Condition = "new" | "pre-owned";

/** Explicit rubric used for price-band scoring. Tags remain descriptive. */
export type ScoringCategory = "diver" | "chronograph" | "gmt" | "dress";

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
  /** Date this asking price was observed. Required for market comparisons. */
  observedAt?: string;
}

/**
 * One observation of a watch's tracked price. The series includes the current
 * price as its last entry, so `price` and the newest snapshot normally agree.
 *
 * `date` is when the price was first seen at this level, not when it was last
 * confirmed: a run that re-reads an unchanged price extends nothing, so the
 * date answers "it has been this much since when?".
 */
export interface PriceSnapshot {
  price: Money;
  /** ISO timestamp of when this price was first observed. */
  date: string;
  /** Where the observation came from, e.g. "scrape", "manual". */
  source?: string;
}

export interface WatchSpecs {
  caseDiameterMm?: number;
  caseThicknessMm?: number;
  lugToLugMm?: number;
  lugWidthMm?: number;
  caseMaterial?: string;
  movement?: MovementType;
  caliber?: string;
  powerReserveHours?: number;
  waterResistanceM?: number;
  crystal?: string;
  dialColor?: string;
  braceletStrap?: string;
  complications?: string;
}

/**
 * Verifiable finishing/engineering details that feed the caseCraft, bracelet,
 * and movement dimensions. All optional: absence means "not recorded", and the
 * scoring engine treats it as unknown, never as a zero.
 */
export interface QualityFlags {
  /** Number of positions the movement is regulated in. 0 or absent = unregulated. */
  regulatedPositions?: number;
  /** Manufacturer accuracy spec in seconds/day, e.g. 12 for +/-12s/d. */
  accuracySpecSpd?: number;
  /** Surface hardening in Vickers, e.g. 1000. */
  hardenedCoatingHv?: number;
  /** Antimagnetic rating in A/m, e.g. 25000. */
  antimagneticAm?: number;
  sapphireBezelInsert?: boolean;
  drilledLugs?: boolean;
  microAdjustClasp?: boolean;
  quickRelease?: boolean;
  braceletIncluded?: boolean;
  /** Anti-reflective coating layer count. */
  arLayers?: number;
}

export type Availability = "in-stock" | "pre-order" | "sold-out" | "discontinued";

export const AVAILABILITY_STATES: Availability[] = [
  "in-stock",
  "pre-order",
  "sold-out",
  "discontinued",
];

/**
 * Non-spec factors that gate a purchase decision. Rendered as chips and used
 * to caveat verdicts; NEVER folded into any numeric score.
 */
export interface Friction {
  availability: Availability;
  /** ISO date, for pre-orders. */
  expectedShipDate?: string;
  /** Extra cost to get the bracelet instead of the stock strap. */
  braceletUpchargeUsd?: number;
  /** 5 = established secondary market, 1 = effectively unsellable. */
  brandLiquidity: 1 | 2 | 3 | 4 | 5;
}

export interface Watch {
  id: string;
  brand: string;
  model: string;
  referenceNumber?: string;
  status: WatchStatus;
  /** Personal wishlist priority bucket for planning. */
  wishlistTier?: WishlistTier;
  /** Rubric category for value scoring; inferred from an unambiguous legacy tag when absent. */
  scoringCategory?: ScoringCategory;
  /** User-rated visual appeal, 1-5. Kept under its original key for data compatibility. */
  designUniqueness?: number;
  /** Pairwise preference rating used only to order watches within the same 1-5 appeal band. */
  designPreferenceElo?: number;
  /** Number of pairwise design choices contributing to designPreferenceElo. */
  designComparisonCount?: number;
  /** Personal, firsthand fit assessment. Kept separate from objective value scoring. */
  personalFit?: number;
  /** Headline price you're tracking (usually the best/target price). */
  price?: Money;
  /** ISO timestamp of when `price` was last refreshed (set by the enrich script). */
  priceUpdatedAt?: string;
  /**
   * Every distinct tracked price seen so far, oldest first. Appended to only
   * when the price actually moves, so consecutive entries always differ.
   */
  priceHistory?: PriceSnapshot[];
  /**
   * "Ping me under $X." Compared against the all-in landed price, so it means
   * the total you are willing to pay, not the sticker.
   */
  targetPrice?: Money;
  /**
   * All-in cost of the configuration actually being considered: base price plus
   * bracelet/strap delta, shipping, and duty. Falls back to `price` when absent.
   */
  landedPrice?: Money;
  qualityFlags?: QualityFlags;
  friction?: Friction;
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

export interface BrandInfo {
  reputationTier: number;
}

export type BrandCatalog = Record<string, BrandInfo>;

export const WATCH_STATUSES: WatchStatus[] = ["wishlist", "owned", "sold"];

export const SCORING_CATEGORIES: ScoringCategory[] = ["diver", "chronograph", "gmt", "dress"];

export const WISHLIST_TIERS: WishlistTier[] = [
  "next-purchase",
  "must-have",
  "love-it",
  "interested",
  "maybe-later",
  "pass",
];

export const WISHLIST_TIER_LABELS: Record<WishlistTier, string> = {
  "next-purchase": "Next purchase",
  "must-have": "Must have",
  "love-it": "Love it",
  interested: "Interested",
  "maybe-later": "Maybe later",
  pass: "Pass",
};

export const MOVEMENT_TYPES: MovementType[] = [
  "automatic",
  "manual",
  "quartz",
  "spring-drive",
  "solar",
  "kinetic",
  "other",
];

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "SGD", "SEK", "NOK", "DKK", "HKD", "NZD"];
