import { NextResponse } from "next/server";
import { detectionProgress, startDetection } from "@/lib/sales/detectionJob";

// POST /api/sales/detect { all?: boolean } — re-check stores' live presets in the background.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { all?: unknown };
  startDetection({ all: body.all === true });
  return NextResponse.json(detectionProgress(), { status: 202 });
}
