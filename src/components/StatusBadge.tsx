import { WatchStatus } from "@/lib/types";

const STYLES: Record<WatchStatus, string> = {
  wishlist: "bg-amber-100 text-amber-800 ring-amber-200",
  owned: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  sold: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function StatusBadge({ status }: { status: WatchStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
