"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DESIGN_RANK_MAX, DESIGN_RANK_MIN } from "@/lib/scoring";
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
  const [filter, setFilter] = useState<Filter>("unranked");
  const [focused, setFocused] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

  const setRank = useCallback(
    async (watch: Watch, next: number | undefined) => {
      const previous = ranks[watch.id];
      if (previous === next) return;
      setRanks((current) => ({ ...current, [watch.id]: next }));
      setError(null);
      try {
        const res = await fetch(`/api/watches/${watch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designUniqueness: next ?? null }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setRanks((current) => ({ ...current, [watch.id]: previous }));
        setError(`Couldn't save the rank for ${watch.brand} ${watch.model}.`);
      }
    },
    [ranks, router]
  );

  // 1-5 ranks the focused watch and moves on; arrows navigate without ranking.
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
          <p className="text-sm font-medium text-slate-700">
            {counts.ranked} of {counts.all} ranked
          </p>
          <p className="text-xs text-slate-500">
            Press <kbd className="rounded border border-slate-300 px-1">1</kbd>–
            <kbd className="rounded border border-slate-300 px-1">5</kbd> to rank and advance,{" "}
            <kbd className="rounded border border-slate-300 px-1">↑</kbd>
            <kbd className="rounded border border-slate-300 px-1">↓</kbd> to move.
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["unranked", "ranked", "all"] as const).map((key) => (
            <button
              key={key}
              onClick={() => applyFilter(key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {key} ({counts[key]})
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="card p-12 text-center text-sm text-slate-500">
          {filter === "unranked" ? "Everything is ranked." : "Nothing to show."}
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
              className={`card flex items-center gap-4 p-3 transition-shadow ${
                index === focused ? "ring-2 ring-slate-900" : ""
              }`}
            >
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{watch.brand}</p>
                <Link href={`/watch/${watch.id}`} className="font-semibold hover:underline">
                  {watch.model}
                </Link>
                <p className="text-sm text-slate-500">{formatMoney(watch.price)}</p>
              </div>

              <div
                role="radiogroup"
                aria-label={`Design rank for ${watch.brand} ${watch.model}`}
                className="flex flex-shrink-0 items-center gap-1"
              >
                {RANKS.map((rank) => {
                  const active = ranks[watch.id] === rank;
                  return (
                    <button
                      key={rank}
                      role="radio"
                      aria-checked={active}
                      title={RANK_HINTS[rank]}
                      onClick={() => void setRank(watch, rank)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
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
                  className="ml-1 px-2 text-xs font-medium text-slate-400 hover:text-slate-900 disabled:opacity-0"
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
