import { NextRequest, NextResponse } from "next/server";
import { getBenchmarks, saveBenchmarks } from "@/lib/calibration-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBenchmarks());
}

export async function PUT(request: NextRequest) {
  try {
    return NextResponse.json(await saveBenchmarks(await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid benchmarks" }, { status: 400 });
  }
}
