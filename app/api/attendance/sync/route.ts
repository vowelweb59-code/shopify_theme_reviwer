import { NextResponse } from "next/server";
import { syncAttendance } from "@/lib/attendance/sync";

// POST /api/attendance/sync { months? } — reads the attendance Chat space now (default: the last 3 months).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { months?: unknown } | null;
  const months = typeof body?.months === "number" ? body.months : undefined;
  try {
    const r = await syncAttendance(months);
    return NextResponse.json({ fetched: r.fetched, space: r.space });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't read the attendance space." }, { status: 400 });
  }
}
