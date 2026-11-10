import { NextResponse, type NextRequest } from "next/server";
import { buildAttendanceReport } from "@/lib/attendance/report";
import { istMonth } from "@/lib/service/chat/months";

// GET /api/attendance?month=YYYY-MM — who reported (Upwork, theme team) against announced leaves, with the missing days flagged.
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? istMonth(new Date());
  try {
    return NextResponse.json(await buildAttendanceReport(month));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't build the report." }, { status: 400 });
  }
}
