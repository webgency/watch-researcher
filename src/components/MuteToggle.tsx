"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IS_STATIC } from "@/lib/config";

/**
 * Mute or unmute one watch's alerts. Immediate, with Undo, rather than a
 * confirmation: it is reversible and deletes nothing, since existing alerts
 * are only hidden. One button element serves both states so keyboard focus
 * stays put when the label changes after the refresh.
 */
export default function MuteToggle({ watchId, muted }: { watchId: string; muted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justMuted, setJustMuted] = useState(false);

  if (IS_STATIC) return muted ? <p className="text-sm text-cocoa-600">Muted. No alerts are recorded for this watch.</p> : null;

  async function toggle() {
    const next = !muted;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mute", watchId, muted: next }),
      });
      if (!response.ok) throw new Error();
      setJustMuted(next);
      router.refresh();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <p role="status" className="text-sm text-cocoa-600">
        {muted ? "Muted. No alerts will be recorded for this watch." : ""}
      </p>
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={muted} className={muted ? "inline-flex min-h-11 items-center text-sm font-medium text-azalea-700 hover:underline" : "btn-secondary min-h-11"}>
        {busy ? "Saving…" : muted ? (justMuted ? "Undo" : "Unmute") : "Mute this watch"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
