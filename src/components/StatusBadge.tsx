import { WatchStatus } from "@/lib/types";

const STYLES: Record<WatchStatus, string> = {
  wishlist: "bg-amber-100 text-amber-800 ring-amber-200",
  owned: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  sold: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function StatusBadge({ status }: { status: WatchStatus }) {
  // The whole app is a wishlist, so a "wishlist" badge is just noise — only
  // surface a badge once a watch is actually owned or sold.
  if (status === "wishlist") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
