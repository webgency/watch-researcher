import path from "path";
import { readAlertState, writeAlertState } from "./alert-file.mjs";
import { alertSummary, appendAlerts, detectAlerts, type AlertEvent, type AlertState } from "./alerts.mjs";
import type { Watch } from "./types";

// Committed beside watches.json, so the published site shows the same alerts
// read-only. Resolved at module load, like the watch store.
const ALERTS_PATH = path.join(process.cwd(), "data", "alerts.json");
let writeQueue: Promise<void> = Promise.resolve();

function withWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(work, work);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function getAlertState(): Promise<AlertState> {
  return readAlertState(ALERTS_PATH);
}

/**
 * Counts for the nav badge. A broken alerts file is logged and hides the
 * badge instead of failing every page that renders the header.
 */
export async function getAlertSummary(): Promise<{ total: number; unread: number } | undefined> {
  try {
    return alertSummary(await getAlertState());
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function updateAlertState(change: (state: AlertState) => AlertState): Promise<AlertState> {
  return withWriteLock(async () => {
    const next = change(await getAlertState());
    await writeAlertState(ALERTS_PATH, next);
    return next;
  });
}

/**
 * Record whatever one watch edit announces. The file is only written when an
 * alert is actually added, so ordinary edits leave alerts.json untouched.
 */
export async function recordWatchAlerts(before: Watch, after: Watch, now: Date = new Date()): Promise<AlertEvent[]> {
  return withWriteLock(async () => {
    const state = await getAlertState();
    const candidates = detectAlerts(before, after, { now, events: state.events });
    const { state: next, added } = appendAlerts(state, candidates, now);
    if (added.length) await writeAlertState(ALERTS_PATH, next);
    return added;
  });
}
