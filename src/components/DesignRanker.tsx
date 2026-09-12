"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DESIGN_ELO_BASE,
  DESIGN_RANK_MAX,
  DESIGN_RANK_MIN,
  type DesignComparisonOutcome,
} from "@/lib/scoring";
import { formatMoney } from "@/lib/format";
import type { Watch } from "@/lib/types";

type Filter = "unranked" | "ranked" | "all";

const RANKS = Array.from(
  { length: DESIGN_RANK_MAX - DESIGN_RANK_MIN + 1 },
  (_, index) => DESIGN_RANK_MIN + index
);

/** What each rank means, so the scale stays stable across a long session. */
const RANK_HINTS: Record<number, string> = {
  1: "Leaves me cold",
  2: "Not for me",
  3: "Fine, unremarkable",
  4: "Really like it",
  5: "Would stare at it",
};

export default function DesignRanker({ watches }: { watches: Watch[] }) {
  const router = useRouter();
  const [ranks, setRanks] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(watches.map((watch) => [watch.id, watch.designUniqueness]))
  );
  const [elos, setElos] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(watches.map((watch) => [watch.id, watch.designPreferenceElo]))
  );
  const [comparisonCounts, setComparisonCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(watches.map((watch) => [watch.id, watch.designComparisonCount ?? 0]))
  );
  const [filter, setFilter] = useState<Filter>("unranked");
  const [focused, setFocused] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [pairOffset, setPairOffset] = useState(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const counts = useMemo(() => {
    const ranked = watches.filter((watch) => ranks[watch.id] !== undefined).length;
    return { ranked, unranked: watches.length - ranked, all: watches.length };
  }, [watches, ranks]);

  // Membership is captured when the filter changes, not on every rank, so a row
  // does not vanish from under the cursor the moment you rank it.
  const [visibleIds, setVisibleIds] = useState<string[]>(() =>
    watches.filter((watch) => watch.designUniqueness === undefined).map((watch) => watch.id)
  );

  const applyFilter = useCallback(
    (next: Filter) => {
      setFilter(next);
      setFocused(0);
      setVisibleIds(
        watches
          .filter((watch) => {
            const rank = ranks[watch.id];
            if (next === "unranked") return rank === undefined;
            if (next === "ranked") return rank !== undefined;
            return true;
          })
          .map((watch) => watch.id)
      );
    },
    [watches, ranks]
  );

  const visible = useMemo(() => {
    const byId = new Map(watches.map((watch) => [watch.id, watch]));
    return visibleIds.flatMap((id) => {
      const watch = byId.get(id);
      return watch ? [watch] : [];
    });
  }, [watches, visibleIds]);

  const preferencePairs = useMemo(() => {
    const pairs: Array<[Watch, Watch]> = [];
    for (let leftIndex = 0; leftIndex < watches.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < watches.length; rightIndex += 1) {
        const left = watches[leftIndex];
        const right = watches[rightIndex];
        const rating = ranks[left.id];
        if (rating !== undefined && rating === ranks[right.id]) pairs.push([left, right]);
      }
    }
    return pairs.sort((a, b) => {
      const comparisonGap =
        comparisonCounts[a[0].id] + comparisonCounts[a[1].id] -
        comparisonCounts[b[0].id] - comparisonCounts[b[1].id];
      if (comparisonGap) return comparisonGap;
      const eloGapA = Math.abs((elos[a[0].id] ?? DESIGN_ELO_BASE) - (elos[a[1].id] ?? DESIGN_ELO_BASE));
      const eloGapB = Math.abs((elos[b[0].id] ?? DESIGN_ELO_BASE) - (elos[b[1].id] ?? DESIGN_ELO_BASE));
      return eloGapA - eloGapB || `${a[0].id}:${a[1].id}`.localeCompare(`${b[0].id}:${b[1].id}`);
    });
  }, [watches, ranks, elos, comparisonCounts]);

  const activePair = preferencePairs.length
    ? preferencePairs[pairOffset % preferencePairs.length]
    : undefined;
  const completedComparisons = Math.floor(
    Object.values(comparisonCounts).reduce((sum, count) => sum + count, 0) / 2
  );

  // Ranking is a fast keyboard pass, so refreshing per save would fire a server
  // round trip per keystroke on top of the PUT. The local state is already
  // optimistic; the refresh only needs to catch the rest of the app up once the
  // burst settles.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 800);
  }, [router]);

  const recordPreference = useCallback(
    async (outcome: DesignComparisonOutcome) => {
      if (!activePair || comparing) return;
      const [left, right] = activePair;
      setComparing(true);
      setError(null);
      try {
        const res = await fetch("/api/design-comparisons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leftId: left.id, rightId: right.id, outcome }),
        });
        const data = (await res.json()) as { left?: Watch; right?: Watch; error?: string };
        if (!res.ok || !data.left || !data.right) throw new Error(data.error || "Comparison could not be saved.");
        setElos((current) => ({
          ...current,
          [data.left!.id]: data.left!.designPreferenceElo,
          [data.right!.id]: data.right!.designPreferenceElo,
        }));
        setComparisonCounts((current) => ({
          ...current,
          [data.left!.id]: data.left!.designComparisonCount ?? 0,
          [data.right!.id]: data.right!.designComparisonCount ?? 0,
        }));
        setPairOffset(0);
        scheduleRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Comparison could not be saved.");
      } finally {
        setComparing(false);
      }
    },
    [activePair, comparing, scheduleRefresh]
  );

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const setRank = useCallback(
    async (watch: Watch, next: number | undefined) => {
      const previous = ranks[watch.id];
      if (previous === next) return;
      const previousElo = elos[watch.id];
      const previousCount = comparisonCounts[watch.id];
      setRanks((current) => ({ ...current, [watch.id]: next }));
      setElos((current) => ({ ...current, [watch.id]: undefined }));
      setComparisonCounts((current) => ({ ...current, [watch.id]: 0 }));
      setError(null);
      try {
        const res = await fetch(`/api/watches/${watch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designUniqueness: next ?? null,
            designPreferenceElo: null,
            designComparisonCount: null,
          }),
        });
        if (!res.ok) throw new Error();
        scheduleRefresh();
      } catch {
        setRanks((current) => ({ ...current, [watch.id]: previous }));
        setElos((current) => ({ ...current, [watch.id]: previousElo }));
        setComparisonCounts((current) => ({ ...current, [watch.id]: previousCount }));
        setError(`Couldn't save the design rating for ${watch.brand} ${watch.model}.`);
      }
    },
    [ranks, elos, comparisonCounts, scheduleRefresh]
  );

  // 1-5 rates the focused watch and moves on; arrows navigate without rating.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocused((current) => {
          const next = current + (event.key === "ArrowDown" ? 1 : -1);
          return Math.min(Math.max(next, 0), Math.max(visible.length - 1, 0));
        });
        return;
      }

      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < DESIGN_RANK_MIN || digit > DESIGN_RANK_MAX) return;
      const watch = visible[focused];
      if (!watch) return;
      event.preventDefault();
      void setRank(watch, digit);
      setFocused((current) => Math.min(current + 1, visible.length - 1));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, focused, setRank]);

  useEffect(() => {
    rowRefs.current[focused]?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  const progress = counts.all === 0 ? 0 : Math.round((counts.ranked / counts.all) * 100);

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-cocoa-700">
            {counts.ranked} of {counts.all} rated
          </p>
          <p className="text-xs text-cocoa-500">
            Press <kbd className="rounded border border-cocoa-300 px-1">1</kbd>–
            <kbd className="rounded border border-cocoa-300 px-1">5</kbd> to rate and advance,{" "}
            <kbd className="rounded border border-cocoa-300 px-1">↑</kbd>
            <kbd className="rounded border border-cocoa-300 px-1">↓</kbd> to move.
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-cocoa-200">
          <div className="h-full rounded-full bg-cocoa-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["unranked", "ranked", "all"] as const).map((key) => (
            <button
              key={key}
              onClick={() => applyFilter(key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === key
                  ? "bg-cocoa-900 text-white"
                  : "bg-white text-cocoa-600 ring-1 ring-cocoa-200 hover:bg-cocoa-100"
              }`}
            >
              {key === "ranked" ? "rated" : key} ({counts[key]})
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">Refine tied ratings</h2>
            <p className="mt-1 text-sm text-cocoa-500">
              Optional head-to-head choices spread similarly rated designs inside their existing 1–5 band.
            </p>
            {completedComparisons > 0 && (
              <p className="mt-1 text-xs text-cocoa-400">
                {completedComparisons} comparison{completedComparisons === 1 ? "" : "s"} recorded
              </p>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={() => setRefining((current) => !current)}>
            {refining ? "Stop refining" : "Refine design order"}
          </button>
        </div>

        {refining && (
          <div className="mt-5 border-t border-cocoa-100 pt-5">
            {activePair ? (
              <>
                <p className="mb-3 text-center text-sm font-medium text-cocoa-700">
                  Both rated {ranks[activePair[0].id]}. Which design do you prefer?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {activePair.map((watch, index) => (
                    <button
                      key={watch.id}
                      type="button"
                      disabled={comparing}
                      onClick={() => void recordPreference(index === 0 ? "left" : "right")}
                      className="overflow-hidden rounded-xl border border-cocoa-200 bg-white text-left transition hover:border-cocoa-400 hover:shadow-md disabled:opacity-60"
                    >
                      <div className="aspect-square bg-gradient-to-br from-cocoa-100 to-cocoa-200">
                        {watch.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={watch.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <span className="block p-3">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-cocoa-400">{watch.brand}</span>
                        <span className="mt-0.5 block font-semibold text-cocoa-800">{watch.model}</span>
                        <span className="mt-2 block text-xs font-medium text-azalea-700">Prefer this design</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" className="btn-secondary" disabled={comparing} onClick={() => void recordPreference("tie")}>
                    About equal
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-cocoa-500 hover:text-cocoa-900"
                    disabled={comparing}
                    onClick={() => setPairOffset((current) => current + 1)}
                  >
                    Show another pair
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-cocoa-50 px-3 py-6 text-center text-sm text-cocoa-500">
                Rate at least two watches with the same appeal score to compare them.
              </p>
            )}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="card p-12 text-center text-sm text-cocoa-500">
          {filter === "unranked" ? "Everything is rated." : "Nothing to show."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((watch, index) => (
            <li
              key={watch.id}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              onMouseDown={() => setFocused(index)}
              className={`card flex flex-col gap-3 p-3 transition-shadow sm:flex-row sm:items-center sm:gap-4 ${
                index === focused ? "ring-2 ring-cocoa-900" : ""
              }`}
            >
              <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-cocoa-100 to-cocoa-200 sm:h-24 sm:w-24">
                  {watch.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={watch.imageUrl}
                      alt={`${watch.brand} ${watch.model}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{watch.brand}</p>
                  <Link href={`/watch/${watch.id}`} className="font-semibold hover:underline">
                    {watch.model}
                  </Link>
                  <p className="text-sm text-cocoa-500">{formatMoney(watch.price)}</p>
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label={`Design appeal for ${watch.brand} ${watch.model}`}
                className="flex w-full flex-shrink-0 items-center justify-center gap-1 border-t border-cocoa-100 pt-3 sm:w-auto sm:justify-start sm:border-0 sm:pt-0"
              >
                {RANKS.map((rank) => {
                  const active = ranks[watch.id] === rank;
                  // Roving tabindex: a radiogroup is one tab stop, not five, so
                  // only the checked option (or the first, when none is) takes
                  // focus from the keyboard.
                  const takesFocus = active || (ranks[watch.id] === undefined && rank === DESIGN_RANK_MIN);
                  return (
                    <button
                      key={rank}
                      role="radio"
                      aria-checked={active}
                      tabIndex={takesFocus ? 0 : -1}
                      title={RANK_HINTS[rank]}
                      onClick={() => void setRank(watch, rank)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                        active
                          ? "bg-cocoa-900 text-white"
                          : "bg-white text-cocoa-600 ring-1 ring-cocoa-200 hover:bg-cocoa-100"
                      }`}
                    >
                      {rank}
                    </button>
                  );
                })}
                <button
                  onClick={() => void setRank(watch, undefined)}
                  disabled={ranks[watch.id] === undefined}
                  title="Clear rank"
                  className="ml-1 px-2 text-xs font-medium text-cocoa-400 hover:text-cocoa-900 disabled:opacity-0"
                >
                  Clear
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
