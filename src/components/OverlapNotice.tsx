import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { OverlapCluster } from "@/lib/overlap";
import { toDisplayScore } from "@/lib/scoring";

/**
 * The overlap warning where it actually changes a decision: on the page of the
 * watch you are considering, not only on the list that groups everything.
 *
 * Shows the other members of this watch's group and which of them leads on
 * value and on your design rank. Those two verdicts stay separate, as they do
 * everywhere else — a watch can be the best buy and not the one you want.
 */
export default function OverlapNotice({ cluster, watchId }: { cluster: OverlapCluster; watchId: string }) {
  const siblings = cluster.members.filter((member) => member.watch.id !== watchId);
  if (siblings.length === 0) return null;

  const leadsValue = cluster.valueLeaderIds.includes(watchId);
  const leadsDesign = cluster.designLeaderIds.includes(watchId);
  const owned = cluster.ownedIds.filter((id) => id !== watchId);

  return (
    <section className="card border-amber-200 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Also on your list</h2>
        <Link href="/overlap" className="text-xs font-medium text-amber-800 underline">
          See all overlaps
        </Link>
      </div>

      <p className="mt-1 text-sm text-slate-700">
        {siblings.length === 1 ? "One other entry is" : `${siblings.length} other entries are`} effectively the same
        purchase: {cluster.label}.{" "}
        {owned.length > 0
          ? "You already own one of them."
          : leadsValue && leadsDesign
            ? "This one leads the group on both value and your design rank."
            : leadsValue
              ? "This one leads on value, but not on your design rank."
              : leadsDesign
                ? "This is your favourite of them, but another scores better for the money."
                : cluster.valueLeaderIds.length === 0
                  ? "Nothing in the group has enough recorded evidence to rank."
                  : "Another entry leads the group on value."}
      </p>

      <ul className="mt-3 space-y-1.5">
        {siblings.map((member) => {
          const value = member.summary.standing.valueScore;
          return (
            <li key={member.watch.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <Link href={`/watch/${member.watch.id}`} className="font-medium hover:underline">
                <span className="text-slate-400">{member.watch.brand}</span> {member.watch.model}
              </Link>
              <span className="text-xs text-slate-500">
                {formatMoney(member.watch.price)} · {member.diameterMm}mm · value{" "}
                <span className="font-semibold">{value === undefined ? "—" : Math.round(toDisplayScore(value))}</span>
              </span>
              {cluster.valueLeaderIds.includes(member.watch.id) && (
                <span className="text-xs font-medium text-sky-700">best value</span>
              )}
              {cluster.designLeaderIds.includes(member.watch.id) && (
                <span className="text-xs font-medium text-violet-700">your favourite</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
