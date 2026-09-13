"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { WISHLIST_TIERS, WISHLIST_TIER_LABELS, type WishlistTier } from "@/lib/types";
import WishlistTierBadge from "./WishlistTierBadge";

const OPTIONS = [...WISHLIST_TIERS, ""] as const;
const labelFor = (tier: WishlistTier | "") => tier ? WISHLIST_TIER_LABELS[tier] : "No priority";

/** One control for reading and editing priority, with keyboard menu navigation. */
export default function PriorityMenu({ tier, watchName, onChange }: {
  tier?: WishlistTier;
  watchName: string;
  onChange: (tier: WishlistTier | "") => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndex = useRef(0);
  const id = useId();

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    items.current[focusIndex.current]?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    }
    function reposition(event: Event) {
      // Scrolling the menu itself must not dismiss it; scrolling its anchor does.
      if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  function show(index = OPTIONS.indexOf(tier ?? "")) {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const above = window.innerHeight - rect.bottom < 340 && rect.top > 340;
    setPosition({
      left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)),
      ...(above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      maxHeight: Math.max(120, above ? rect.top - 12 : window.innerHeight - rect.bottom - 12),
    });
    focusIndex.current = index;
    setError(false);
    setOpen(true);
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      // Resume the card/table tab order rather than the portal's document position.
      close(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const current = items.current.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % OPTIONS.length;
    else if (event.key === "ArrowUp") next = (current - 1 + OPTIONS.length) % OPTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OPTIONS.length - 1;
    else if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
      const order = OPTIONS.map((_, i) => (current + i + 1) % OPTIONS.length);
      next = order.find(i => labelFor(OPTIONS[i]).toLowerCase().startsWith(event.key.toLowerCase())) ?? current;
    } else return;
    event.preventDefault();
    items.current[next]?.focus();
  }

  async function choose(next: WishlistTier | "") {
    if (saving) return;
    if (next === (tier ?? "")) { close(true); return; }
    setSaving(true);
    setError(false);
    try {
      if (await onChange(next)) close(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={root} className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !panel.current?.contains(event.relatedTarget as Node | null)) close();
    }}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Priority for ${watchName}: ${tier ? labelFor(tier) : "not set"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="flex min-h-8 items-center gap-1 rounded-full text-xs text-cocoa-600 hover:bg-cocoa-50"
        onClick={() => open ? close() : show()}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp" ? OPTIONS.length - 1 : 0);
          }
        }}
      >
        {tier ? <WishlistTierBadge tier={tier} /> : <span className="px-2">Set priority</span>}
        <span aria-hidden="true" className="pr-2">▾</span>
      </button>
      {/* A portal keeps the menu outside the compact table's scroll clipping. */}
      {open && createPortal(
        <div ref={panel} style={position} className="fixed z-50 w-52 overflow-y-auto rounded-xl border border-cocoa-200 bg-white p-1.5 shadow-lg">
          <div id={id} role="menu" aria-label={`Priority for ${watchName}`} aria-busy={saving} onKeyDown={navigate}>
            {OPTIONS.map((option, index) => (
              <button
                key={option || "none"}
                ref={node => { items.current[index] = node; }}
                type="button"
                role="menuitemradio"
                aria-checked={option === (tier ?? "")}
                aria-disabled={saving}
                tabIndex={-1}
                onClick={() => void choose(option)}
                className="flex min-h-9 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-cocoa-900 hover:bg-cocoa-50 focus:bg-azalea-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cocoa-900"
              >
                {labelFor(option)}<span aria-hidden="true">{option === (tier ?? "") ? "✓" : ""}</span>
              </button>
            ))}
          </div>
          {saving && <p role="status" className="px-3 py-2 text-xs text-cocoa-500">Saving priority…</p>}
          {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">Couldn’t save priority. Please try again.</p>}
        </div>, document.body
      )}
    </div>
  );
}
