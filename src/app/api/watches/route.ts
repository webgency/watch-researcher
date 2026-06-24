import { NextRequest, NextResponse } from "next/server";
import { addWatch, getWatches } from "@/lib/store";
import { WatchInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const watches = await getWatches();
  return NextResponse.json(watches);
}

export async function POST(req: NextRequest) {
  let body: Partial<WatchInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.brand?.trim() || !body.model?.trim()) {
    return NextResponse.json({ error: "brand and model are required" }, { status: 400 });
  }

  const watch = await addWatch({
    brand: body.brand.trim(),
    model: body.model.trim(),
    referenceNumber: body.referenceNumber,
    status: body.status ?? "wishlist",
    priority: body.priority,
    grail: body.grail,
    favorite: body.favorite,
    price: body.price,
    links: body.links ?? [],
    imageUrl: body.imageUrl,
    specs: body.specs ?? {},
    tags: body.tags ?? [],
    notes: body.notes,
    purchase: body.purchase,
    sale: body.sale,
  });

  return NextResponse.json(watch, { status: 201 });
}
