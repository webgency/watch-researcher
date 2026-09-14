import { NextRequest, NextResponse } from "next/server";
import { parseListingFields } from "@/lib/listing-entry";
import { ListingConflictError, saveWatchListing } from "@/lib/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function save(req: NextRequest, { params }: Context, editing: boolean) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Could not read the listing. Please try again." }, { status: 400 }); }
  const parsed = parseListingFields(body?.fields);
  if (!parsed.ok) return NextResponse.json({ error: "Check the highlighted fields.", errors: parsed.errors }, { status: 400 });
  if (editing && typeof body?.revision !== "string") return NextResponse.json({ error: "Reopen this listing before editing it." }, { status: 400 });
  try {
    const { id } = await params;
    const watch = await saveWatchListing(id, parsed.listing, editing ? body.revision : undefined);
    if (!watch) return NextResponse.json({ error: "This watch no longer exists." }, { status: 404 });
    return NextResponse.json({ links: watch.links });
  } catch (error) {
    if (error instanceof ListingConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Couldn't save the listing. Your draft is still here; try again." }, { status: 500 });
  }
}

export const POST = (req: NextRequest, context: Context) => save(req, context, false);
export const PATCH = (req: NextRequest, context: Context) => save(req, context, true);
