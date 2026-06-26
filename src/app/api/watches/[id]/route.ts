import { NextRequest, NextResponse } from "next/server";
import { deleteWatch, getWatch, updateWatch } from "@/lib/store";
import { normalizeWatchPatch } from "@/lib/validation";

export const dynamic = "force-dynamic";

type WatchRouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: WatchRouteContext) {
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(watch);
}

export async function PUT(req: NextRequest, { params }: WatchRouteContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = normalizeWatchPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid watch update", errors: parsed.errors }, { status: 400 });
  }

  const { id } = await params;
  const updated = await updateWatch(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: WatchRouteContext) {
  const { id } = await params;
  const ok = await deleteWatch(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
