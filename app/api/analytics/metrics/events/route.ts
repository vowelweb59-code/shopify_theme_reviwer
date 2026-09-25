import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getEventSummary } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/events — count and users for every tracked
// event, primary events first. Same query as /overview.
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getEventSummary(query));
  } catch (err) {
    return metricsErrorResponse(err, "events");
  }
}
