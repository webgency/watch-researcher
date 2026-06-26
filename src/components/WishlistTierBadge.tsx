import { WishlistTier, WISHLIST_TIER_LABELS } from "@/lib/types";

const STYLES: Record<WishlistTier, string> = {
  "next-purchase": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "must-have": "bg-indigo-100 text-indigo-800 ring-indigo-200",
  "love-it": "bg-rose-100 text-rose-800 ring-rose-200",
  interested: "bg-sky-100 text-sky-800 ring-sky-200",
  "maybe-later": "bg-amber-100 text-amber-800 ring-amber-200",
  pass: "bg-slate-100 text-slate-600 ring-slate-200",
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
