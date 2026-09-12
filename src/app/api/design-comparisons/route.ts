import { NextRequest, NextResponse } from "next/server";
import { recordDesignComparison } from "@/lib/store";
import type { DesignComparisonOutcome } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const OUTCOMES = new Set<DesignComparisonOutcome>(["left", "right", "tie"]);

export async function POST(req: NextRequest) {
  let body: { leftId?: unknown; rightId?: unknown; outcome?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.leftId !== "string" ||
    typeof body.rightId !== "string" ||
    typeof body.outcome !== "string" ||
    !OUTCOMES.has(body.outcome as DesignComparisonOutcome)
  ) {
    return NextResponse.json({ error: "Choose two watches and a valid outcome." }, { status: 400 });
  }

  const result = await recordDesignComparison(
    body.leftId,
    body.rightId,
    body.outcome as DesignComparisonOutcome
  );
  if (!result) {
    return NextResponse.json(
      { error: "Both watches must exist and share the same design-appeal rating." },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
