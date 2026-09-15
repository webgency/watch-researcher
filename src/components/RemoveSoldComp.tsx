"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SoldComp } from "@/lib/types";
import { soldCompRevision } from "@/lib/sold-comp-entry";
import { IS_STATIC } from "@/lib/config";

/**
 * Removes one recorded sale. Local only, like AddSoldComp.
 *
 * Asks for confirmation inline: a sold comp is hand-entered and can't be
 * re-scraped, so a stray click would lose it for good. The request names the
 * sale by content, not position, so a stale page can't remove a different one.
 */
export default function RemoveSoldComp({ watchId, comp }: { watchId: string; comp: SoldComp }) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Keep is the safe default, so focus lands there when asked to confirm.
  useEffect(() => { if (confirming) keep.current?.focus(); }, [confirming]);

  if (IS_STATIC) return null;

  function cancel() {
    setConfirming(false);
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function remove() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/watches/${encodeURIComponent(watchId)}/sold-comps`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: soldCompRevision(comp) }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) router.refresh();
        throw new Error(result.error || "Couldn't remove that sale. Try again.");
      }
      setConfirming(false);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't remove that sale. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!confirming) {
    return (
      <button ref={trigger} type="button" className="inline-flex min-h-11 items-center text-xs font-medium text-cocoa-500 hover:text-red-700 hover:underline" onClick={() => setConfirming(true)}>
        Remove
      </button>
    );
  }

  return (
    <span role="group" aria-label="Confirm removing this sale" className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-cocoa-600">Remove this sale?</span>
      <button type="button" className="min-h-11 font-semibold text-red-700 hover:underline disabled:opacity-50" onClick={remove} disabled={saving}>
        {saving ? "Removing…" : "Remove"}
      </button>
      <button ref={keep} type="button" className="min-h-11 font-medium text-cocoa-600 hover:underline" onClick={cancel} disabled={saving}>
        Keep
      </button>
      {error && <span role="alert" className="font-medium text-red-700">{error}</span>}
    </span>
  );
}
