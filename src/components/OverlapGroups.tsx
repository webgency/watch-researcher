import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { EXCLUSION_LABELS, ExclusionReason, OverlapCluster, OverlapMember, OverlapReport } from "@/lib/overlap";
import { PAR_SCORE, toDisplayScore } from "@/lib/scoring";
import StatusBadge from "./StatusBadge";
import WishlistTierBadge from "./WishlistTierBadge";

function initials(brand: string, model: string): string {
  return ((brand.trim()[0] ?? "?") + (model.trim()[0] ?? "")).toUpperCase();
}

/** Score chip. An absent score reads "unrated", never 0 — see the scoring rules. */
function ScoreChip({ label, score, muted }: { label: string; score: number | null | undefined; muted?: boolean }) {
  if (score === null || score === undefined) {
    return (
      <span className="whitespace-nowrap text-xs text-slate-400" title={`${label} unrated: not enough recorded evidence`}>
        {label} <span className="font-semibold">—</span>
      </span>
    );
  }
  return (
    <span className={`whitespace-nowrap text-xs ${muted ? "text-slate-500" : "text-slate-700"}`}>
      {label} <span className="font-semibold tabular-nums">{Math.round(score)}</span>
    </span>
  );
}

function Badge({ tone, children, title }: { tone: "value" | "design" | "owned" | "warn"; children: React.ReactNode; title?: string }) {
  const styles = {
    value: "bg-sky-100 text-sky-800 ring-sky-200",
    design: "bg-violet-100 text-violet-800 ring-violet-200",
    owned: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-100 text-amber-800 ring-amber-200",
  } as const;
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

const PAR_DISPLAY = toDisplayScore(PAR_SCORE);

function MemberRow({ member, cluster }: { member: OverlapMember; cluster: OverlapCluster }) {
  const { watch, summary } = member;
  const { standing } = summary;
  const leadsValue = cluster.valueLeaderIds.includes(watch.id);
  const leadsDesign = cluster.designLeaderIds.includes(watch.id);
  const value = standing.valueScore === undefined ? undefined : toDisplayScore(standing.valueScore);

  return (
    <li className="flex items-start gap-3 py-3">
      <Link
        href={`/watch/${watch.id}`}
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200"
        aria-hidden
        tabIndex={-1}
      >
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={watch.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-slate-400">{initials(watch.brand, watch.model)}</span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/watch/${watch.id}`} className="min-w-0 truncate font-medium hover:underline">
            <span className="text-slate-400">{watch.brand}</span> {watch.model}
          </Link>
          {leadsValue && (
            <Badge tone="value" title="Highest value score in this group">
              Best value
            </Badge>
          )}
          {leadsDesign && (
            <Badge tone="design" title="Your highest design rank in this group">
              Your favourite
            </Badge>
          )}
          <WishlistTierBadge tier={watch.wishlistTier} />
          <StatusBadge status={watch.status} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{formatMoney(watch.price)}</span>
          <span>{member.diameterMm}mm</span>
          <ScoreChip label="Value" score={value} />
          <ScoreChip label="Design" score={summary.designScore} />
          <span title={`${Math.round(standing.evidenceCoverage * 100)}% of applicable evidence recorded`}>
            {standing.confidence} confidence
          </span>
        </div>

        {/* Friction is descriptive only and never touched the grouping or the
            ranking above; it is shown because it still gates a purchase. */}
        {standing.frictions.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">{standing.frictions.join(" · ")}</p>
        )}
      </div>

      {value !== undefined && (
        <div className="hidden w-24 flex-shrink-0 sm:block" aria-hidden>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${value >= PAR_DISPLAY ? "bg-emerald-500" : "bg-slate-400"}`}
              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] uppercase tracking-wide text-slate-400">
            {value >= PAR_DISPLAY ? "above par" : "below par"}
          </p>
        </div>
      )}
    </li>
  );
}

function verdict(cluster: OverlapCluster): { tone: "value" | "design" | "owned" | "warn"; text: string } {
  if (cluster.ownedIds.length > 0) {
    return { tone: "owned", text: "You already own one of these" };
  }
  if (cluster.repeatedBrands.length > 0) {
    return { tone: "warn", text: `Two entries from ${cluster.repeatedBrands.join(" and ")}` };
  }
  if (cluster.agreement === "diverge") {
    return { tone: "warn", text: "Best value isn't the one you like most" };
  }
  if (cluster.agreement === "agree") {
    return { tone: "value", text: "Value and taste pick the same watch" };
  }
  return { tone: "warn", text: "Not enough recorded evidence to pick one" };
}

function ClusterCard({ cluster }: { cluster: OverlapCluster }) {
  const summary = verdict(cluster);
  const compareIds = cluster.members.slice(0, 4).map((member) => member.watch.id);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold">{cluster.label}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {cluster.members.length} entries competing for the same slot
          </p>
        </div>
        {/* One row on every width: stacking the verdict above the button left a
            stranded Compare on its own line on mobile. */}
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Badge tone={summary.tone}>{summary.text}</Badge>
          <Link href={`/compare?ids=${compareIds.join(",")}`} className="btn-secondary h-8 flex-shrink-0 px-3 text-xs">
            Compare
          </Link>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-slate-100">
        {cluster.members.map((member) => (
          <MemberRow key={member.watch.id} member={member} cluster={cluster} />
        ))}
      </ul>
    </section>
  );
}

function UncheckedList({ unchecked }: { unchecked: OverlapReport["unchecked"] }) {
  const byReason = new Map<ExclusionReason, OverlapReport["unchecked"]>();
  for (const entry of unchecked) {
    const list = byReason.get(entry.reason);
    if (list) list.push(entry);
    else byReason.set(entry.reason, [entry]);
  }

  return (
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        {unchecked.length} watch{unchecked.length === 1 ? "" : "es"} couldn&apos;t be checked
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Overlap needs a category, a case diameter, and a price. A missing input is reported here rather than guessed,
        so nothing below is a claim that these watches are distinct.
      </p>
      <div className="mt-3 space-y-4">
        {[...byReason.entries()].map(([reason, entries]) => (
          <div key={reason}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{EXCLUSION_LABELS[reason]}</p>
            <ul className="mt-1 space-y-0.5">
              {entries.map((entry) => (
                <li key={entry.watch.id} className="text-sm">
                  <Link href={`/watch/${entry.watch.id}`} className="hover:underline">
                    <span className="text-slate-400">{entry.watch.brand}</span> {entry.watch.model}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function OverlapGroups({ report, warnings }: { report: OverlapReport; warnings?: string[] }) {
  const overlapping = report.clusters.reduce((sum, cluster) => sum + cluster.members.length, 0);
  const diverging = report.clusters.filter((cluster) => cluster.agreement === "diverge").length;

  return (
    <div className="space-y-4">
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{warnings.join(" · ")}</div>
      )}

      {/* Even 2x2 on mobile; a wrapping flex row left one figure stranded. */}
      <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-4 text-sm sm:flex sm:flex-wrap sm:gap-x-10 sm:p-5">
        <div>
          <p className="text-2xl font-bold tabular-nums">{report.clusters.length}</p>
          <p className="text-xs text-slate-500">overlapping groups</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{overlapping}</p>
          <p className="text-xs text-slate-500">of {report.checkedCount} checked watches in one</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{report.distinctCount}</p>
          <p className="text-xs text-slate-500">stand alone</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{diverging}</p>
          <p className="text-xs text-slate-500">where value and taste disagree</p>
        </div>
      </div>

      {report.clusters.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          No overlaps found. Every checked watch differs from the others in category, size, or price.
        </p>
      ) : (
        report.clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} />)
      )}

      {report.unchecked.length > 0 && <UncheckedList unchecked={report.unchecked} />}
    </div>
  );
}
