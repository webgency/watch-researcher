import { formatAgeDays } from "@/lib/format";
import { FreshnessTier } from "@/lib/valuation";

const STYLE: Record<FreshnessTier, string> = {
  fresh: "bg-emerald-100 text-emerald-800",
  aging: "bg-blue-100 text-blue-800",
  stale: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
};

const TITLE: Record<FreshnessTier, string> = {
  fresh: "Fresh: observed within 7 days",
  aging: "Aging: observed 8–30 days ago",
  stale: "Stale: observed 31–90 days ago",
  expired: "Expired: observed more than 90 days ago",
};

export default function FreshnessBadge({
  tier,
  ageDays,
  compact = false,
}: {
  tier: FreshnessTier;
  ageDays?: number;
  compact?: boolean;
}) {
  const text = compact && ageDays !== undefined
    ? `${tier} · ${formatAgeDays(ageDays)}`
    : tier;
  return (
    <span
      title={TITLE[tier]}
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STYLE[tier]}`}
    >
      {text}
    </span>
  );
}
