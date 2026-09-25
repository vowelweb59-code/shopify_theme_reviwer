import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { latestSyncByTheme } from "@/lib/analytics/sync/runSync";

// GET /api/analytics/sync — each theme's newest sync job, keyed by theme id.
// Small by design (one row per theme), so the UI can poll it while syncing.
export async function GET() {
  await connectToDatabase();
  return NextResponse.json({ latest: await latestSyncByTheme() });
}
