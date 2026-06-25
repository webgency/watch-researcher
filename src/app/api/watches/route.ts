import { NextRequest, NextResponse } from "next/server";
import { addWatch, getWatches } from "@/lib/store";
import { normalizeWatchInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const watches = await getWatches();
  return NextResponse.json(watches);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = normalizeWatchInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid watch", errors: parsed.errors }, { status: 400 });
  }

  const watch = await addWatch(parsed.data);

  return NextResponse.json(watch, { status: 201 });
}
