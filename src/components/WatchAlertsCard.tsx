import Link from "next/link";
import type { AlertState } from "@/lib/alerts.mjs";
import { ALERT_TYPE_LABELS, watchAlertStatus } from "@/lib/alert-status";
import { formatDate } from "@/lib/format";
import type { Watch } from "@/lib/types";
import MuteToggle from "./MuteToggle";

/**
 * This watch's alert coverage, with the reason for every type that can't
 * fire. The alerts page lists rules globally; only here can it say that a
 * watch rated Maybe later will never announce a fresh offer.
 */
export default function WatchAlertsCard({ watch, state }: { watch: Watch; state?: AlertState }) {
  const status = state && watchAlertStatus(watch, state);

  return (
    <section aria-labelledby="watch-alerts-heading" className="card p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="watch-alerts-heading" className="text-base font-semibold text-cocoa-900">Alerts for this watch</h3>
        <Link href="/alerts#alert-settings" className="inline-flex min-h-11 items-center text-sm font-medium text-azalea-700 hover:underline">
          Alert settings
        </Link>
      </div>

      {!status ? (
        <p className="text-sm text-cocoa-500">The alerts file couldn&apos;t be read, so this watch&apos;s alert status is unknown.</p>
      ) : (
        <>
          <ul className="divide-y divide-cocoa-100">
            {status.types.map(({ type, watching, detail }) => (
              <li key={type} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="text-sm font-medium text-cocoa-800">{ALERT_TYPE_LABELS[type]}</span>
                <span className={`text-sm ${watching ? "text-emerald-800" : "text-cocoa-500"}`}>{detail}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-cocoa-100 pt-2">
            <p className="text-xs text-cocoa-500">
              {status.lastEvent ? (
                <>
                  Last alert:{" "}
                  <Link href="/alerts" className="font-medium text-azalea-700 hover:underline">
                    {ALERT_TYPE_LABELS[status.lastEvent.type]} · {formatDate(status.lastEvent.createdAt)}
                  </Link>
                </>
              ) : (
                "No alerts recorded for this watch yet."
              )}
            </p>
            <MuteToggle watchId={watch.id} muted={status.muted} />
          </div>
          <p className="mt-2 text-xs text-cocoa-400">Alerts fire when an edit or a price check changes something, never when a page loads.</p>
        </>
      )}
    </section>
  );
}
