import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { startSync } from "@/lib/analytics/sync/runSync";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";

// POST /api/analytics/themes/[id]/sync — manual "Sync now". Starts in the
// background and answers 202 with the job; poll GET /api/analytics/sync for
// progress. 409 if a sync is already running; a job waiting to retry is
// resumed immediately instead.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  try {
    const { sync } = await startSync(id, "manual");
    return NextResponse.json({ sync }, { status: 202 });
  } catch (err) {
    return themeErrorResponse(err, "start sync");
  }
}
