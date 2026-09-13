import type { AvailableDealScore, MarketConfidence } from "./valuation";

/**
 * One line of deal verdict. Shared so the hero summary and the market chapter
 * cannot drift into describing the same number two different ways.
 *
 * Moves under half a percent read as "at the median": the inputs are a handful
 * of asking prices, and a "0% below" verdict would claim a precision the
 * evidence does not have.
 */
export function dealVerdict(deal: AvailableDealScore): string {
  const discount = deal.discountPct;
  return discount > 0.5
    ? `${Math.round(discount)}% below fair asks`
    : discount < -0.5
      ? `${Math.round(Math.abs(discount))}% above fair asks`
      : "At the fair asking median";
}

/** Confidence wording, identical everywhere it appears. */
export const CONFIDENCE_LABEL: Record<MarketConfidence, string> = {
  insufficient: "Insufficient",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const CONFIDENCE_STYLE: Record<MarketConfidence, string> = {
  insufficient: "bg-cocoa-100 text-cocoa-600",
  low: "bg-amber-50 text-amber-800",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-emerald-50 text-emerald-700",
};
