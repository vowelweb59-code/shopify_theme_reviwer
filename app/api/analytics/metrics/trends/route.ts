import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getTrends } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/trends — daily users, sessions, Theme Views,
// Try Theme and installs, with the previous period aligned day by day.
// Same query parameters as /overview.
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getTrends(query));
  } catch (err) {
    return metricsErrorResponse(err, "trends");
  }
}
