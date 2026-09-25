import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getJourney } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/journey — Session → Page View → Theme View →
// Try Theme → Theme Install as aggregate step counts (not user sequences),
// with step-to-step ratios and the previous period. Same query as /overview.
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getJourney(query));
  } catch (err) {
    return metricsErrorResponse(err, "journey");
  }
}
