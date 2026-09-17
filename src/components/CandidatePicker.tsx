"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TradeUpCandidate } from "@/lib/trade-up";
import { candidatePriceSummary, groupCandidates } from "@/lib/candidate-search";

/**
 * Searchable picker for the trade-up candidate: an ARIA combobox with a listbox
 * popup. Typing filters by brand and model; results are grouped Shortlist,
 * Watching, Pass so the watches you'd buy next come first, and each option
 * shows the price it would be compared at. A long native select made the
 * reader scroll dozens of names and choose a watch just to see its price.
 *
 * Focus stays in the input; the active option is announced through
 * aria-activedescendant, and options keep the input focused on mouse down.
 */
export default function CandidatePicker({ id, candidates, selectedId, onSelect }: {
  id: string;
  candidates: TradeUpCandidate[];
  selectedId: string;
  onSelect: (candidateId: string) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const groups = useMemo(() => groupCandidates(candidates, query), [candidates, query]);
  const flat = useMemo(() => groups.flatMap((group) => group.candidates), [groups]);
  const optionId = (candidateId: string) => `${listId}-option-${candidateId}`;

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    const index = flat.findIndex((candidate) => candidate.id === selectedId);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setQuery("");
  }
  function choose(candidate: TradeUpCandidate) {
    onSelect(candidate.id);
    close();
  }
  function move(step: number) {
    if (!open) return openList();
    setActive((index) => (flat.length ? (index + step + flat.length) % flat.length : 0));
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && open && flat[active]) {
      event.preventDefault();
      choose(flat[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if (event.key === "Tab" && open) {
      close();
    }
  }

  return (
    <div className="relative mt-3">
      <div className="flex items-center gap-2">
        <input
          id={id}
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? optionId(flat[active].id) : undefined}
          autoComplete="off"
          spellCheck={false}
          className="input min-h-11 w-full"
          placeholder="Search wishlist watches"
          value={open ? query : selected?.label ?? ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          onBlur={close}
        />
        {selected && !open && (
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-azalea-700 hover:underline"
            onClick={() => {
              onSelect("");
              input.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-cocoa-200 bg-white shadow-lg">
          {flat.length === 0 ? (
            <p role="status" className="px-3 py-3 text-sm text-cocoa-500">
              No wishlist watches match &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <div ref={list} id={listId} role="listbox" aria-label="Wishlist watches" className="max-h-80 overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.tier} role="group" aria-labelledby={`${listId}-${group.tier}`}>
                  <div id={`${listId}-${group.tier}`} className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-cocoa-500">
                    {group.label} · {group.candidates.length}
                  </div>
                  {group.candidates.map((candidate) => {
                    const index = flat.indexOf(candidate);
                    return (
                      <div
                        key={candidate.id}
                        id={optionId(candidate.id)}
                        role="option"
                        aria-selected={candidate.id === selectedId}
                        data-index={index}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(candidate)}
                        className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                          index === active ? "bg-azalea-50 text-cocoa-950" : "text-cocoa-800"
                        }`}
                      >
                        <span className="min-w-0 break-words">
                          {candidate.id === selectedId && <span aria-hidden="true" className="mr-1">✓</span>}
                          {candidate.label}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-cocoa-500">{candidatePriceSummary(candidate)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
