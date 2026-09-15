import { WishlistTier, WISHLIST_TIER_LABELS } from "@/lib/types";

// Neutral on purpose. Green or pink priority chips read as a verdict beside
// rubric value and deal evidence; a personal filter label should not.
const STYLES: Record<WishlistTier, string> = {
  shortlist: "bg-cocoa-100 text-cocoa-800 ring-cocoa-300",
  watching: "bg-white text-cocoa-600 ring-cocoa-200",
  pass: "bg-cocoa-50 text-cocoa-400 ring-cocoa-200",
};

export default function WishlistTierBadge({ tier }: { tier?: WishlistTier }) {
  if (!tier) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[tier]}`}
    >
      {WISHLIST_TIER_LABELS[tier]}
    </span>
  );
}
