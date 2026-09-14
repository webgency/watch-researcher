import { NextRequest, NextResponse } from "next/server";
import { getAlertState, updateAlertState } from "@/lib/alert-store";
import {
  ALERT_TYPES,
  markAlertsRead,
  setAlertTypeEnabled,
  setWatchMuted,
  type AlertState,
  type AlertType,
} from "@/lib/alerts.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAlertState());
}

type AlertChange = (state: AlertState) => AlertState;

function alertChange(body: unknown): AlertChange | undefined {
  if (!body || typeof body !== "object") return undefined;
  const input = body as Record<string, unknown>;

  if (input.action === "mark-read") {
    if (input.ids === undefined) return (state) => markAlertsRead(state);
    if (!Array.isArray(input.ids) || !input.ids.every((id) => typeof id === "string")) return undefined;
    const ids = input.ids as string[];
    return (state) => markAlertsRead(state, ids);
  }
  if (input.action === "mute" && typeof input.watchId === "string" && input.watchId && typeof input.muted === "boolean") {
    const { watchId, muted } = input as { watchId: string; muted: boolean };
    return (state) => setWatchMuted(state, watchId, muted);
  }
  if (input.action === "type" && ALERT_TYPES.includes(input.type as AlertType) && typeof input.enabled === "boolean") {
    const { type, enabled } = input as { type: AlertType; enabled: boolean };
    return (state) => setAlertTypeEnabled(state, type, enabled);
  }
  return undefined;
}

// PATCH { action: "mark-read", ids? } | { action: "mute", watchId, muted } | { action: "type", type, enabled }
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const change = alertChange(body);
  if (!change) return NextResponse.json({ error: "Unknown alert change" }, { status: 400 });
  return NextResponse.json(await updateAlertState(change));
}
