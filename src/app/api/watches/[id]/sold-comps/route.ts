import { NextRequest, NextResponse } from "next/server";
import { parseSoldCompFields } from "@/lib/sold-comp-entry";
import { addSoldComp, removeSoldComp, SoldCompConflictError } from "@/lib/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function readBody(req: NextRequest) {
  try { return await req.json(); } catch { return undefined; }
}

// POST { fields } records one sale.
export async function POST(req: NextRequest, { params }: Context) {
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Could not read the sale. Please try again." }, { status: 400 });
  const parsed = parseSoldCompFields(body.fields);
  if (!parsed.ok) return NextResponse.json({ error: "Check the highlighted fields.", errors: parsed.errors }, { status: 400 });
  try {
    const { id } = await params;
    const watch = await addSoldComp(id, parsed.comp);
    if (!watch) return NextResponse.json({ error: "This watch no longer exists." }, { status: 404 });
    return NextResponse.json({ soldComps: watch.soldComps ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't record the sale. Your draft is still here; try again." }, { status: 500 });
  }
}

// DELETE { revision } removes the sale the page showed.
export async function DELETE(req: NextRequest, { params }: Context) {
  const body = await readBody(req);
  if (typeof body?.revision !== "string") return NextResponse.json({ error: "Reload the page before removing this sale." }, { status: 400 });
  try {
    const { id } = await params;
    const watch = await removeSoldComp(id, body.revision);
    if (!watch) return NextResponse.json({ error: "This watch no longer exists." }, { status: 404 });
    return NextResponse.json({ soldComps: watch.soldComps ?? [] });
  } catch (error) {
    if (error instanceof SoldCompConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Couldn't remove the sale. Try again." }, { status: 500 });
  }
}
