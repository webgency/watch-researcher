import { NextRequest, NextResponse } from "next/server";
import { scrapeWatch } from "@/lib/scrape";

export const dynamic = "force-dynamic";

// POST { url } -> best-effort extracted watch fields for pre-filling the add form.
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    return NextResponse.json({ error: "Enter a full http(s) URL." }, { status: 400 });
  }

  try {
    const data = await scrapeWatch(url);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Couldn't fetch that page." }, { status: 502 });
  }
}
