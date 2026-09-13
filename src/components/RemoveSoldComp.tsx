"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SoldComp } from "@/lib/types";

/**
 * Removes one recorded sale. Local only, like AddSoldComp.
 *
 * Asks for confirmation inline: a sold comp is hand-entered and can't be
 * re-scraped, so a stray click would lose it for good.
 */
export default function RemoveSoldComp({
  watchId,
  existing,
  index,
}: {
  watchId: string;
  existing: SoldComp[];
  /** Position in `existing`, not in the date-sorted list on screen. */
  index: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function remove() {
    const remaining = existing.filter((_, i) => i !== index);
    setSaving(true);
    try {
      const res = await fetch(`/api/watches/${watchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // null clears the field, so removing the last sale leaves no empty
        // `soldComps: []` behind in watches.json.
        body: JSON.stringify({ soldComps: remaining.length ? remaining : null }),
      });
      if (!res.ok) throw new Error();
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not remove that sale.");
    } finally {
      setSaving(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-cocoa-400 hover:text-red-600 hover:underline"
        onClick={() => setConfirming(true)}
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-cocoa-600">Remove this sale?</span>
      <button
        type="button"
        className="font-semibold text-red-600 hover:underline disabled:opacity-50"
        onClick={remove}
        disabled={saving}
      >
        {saving ? "Removing…" : "Remove"}
      </button>
      <button
        type="button"
        className="font-medium text-cocoa-500 hover:underline"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
      >
        Keep
      </button>
      {error && (
        <span role="alert" className="font-medium text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
