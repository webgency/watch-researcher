"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AlertActionBody =
  | { action: "mark-read"; ids?: string[] }
  | { action: "mute"; watchId: string; muted: boolean }
  | { action: "type"; type: "target_met" | "price_drop" | "fresh_offer"; enabled: boolean };

/**
 * One button per alert setting change. Local only: the published export has
 * no API, so the alerts page never renders these there. Refreshing the router
 * also re-renders the layout, which keeps the nav badge in step.
 */
export default function AlertAction({
  body,
  className,
  pressed,
  children,
}: {
  body: AlertActionBody;
  className?: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={className} onClick={run} disabled={busy} aria-pressed={pressed}>
        {children}
      </button>
      {failed && (
        <span role="alert" className="text-xs font-medium text-red-600">
          Couldn&apos;t save.
        </span>
      )}
    </span>
  );
}
