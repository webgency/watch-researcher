import { NextRequest, NextResponse } from "next/server";
import { parseTargetFields } from "@/lib/target-entry";
import { saveWatchTarget, TargetConflictError } from "@/lib/store";
import type { Money } from "@/lib/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// PUT { fields: { amount, currency }, revision } sets the target;
// PUT { clear: true, revision } removes it.
export async function PUT(req: NextRequest, { params }: Context) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Could not read the target. Please try again." }, { status: 400 }); }
  if (typeof body?.revision !== "string") return NextResponse.json({ error: "Reopen the target before changing it." }, { status: 400 });

  let target: Money | undefined;
  if (body.clear !== true) {
    const parsed = parseTargetFields(body.fields);
    if (!parsed.ok) return NextResponse.json({ error: "Check the highlighted fields.", errors: parsed.errors }, { status: 400 });
    target = parsed.target;
  }

  try {
    const { id } = await params;
    const watch = await saveWatchTarget(id, target, body.revision);
    if (!watch) return NextResponse.json({ error: "This watch no longer exists." }, { status: 404 });
    return NextResponse.json({ targetPrice: watch.targetPrice ?? null });
  } catch (error) {
    if (error instanceof TargetConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Couldn't save the target. Your draft is still here; try again." }, { status: 500 });
  }
}
