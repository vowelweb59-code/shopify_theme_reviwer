import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getOverview } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/overview — Try Theme clicks, installs and
// install rate, current vs previous period. Query: theme=all|<id|slug>,
// range=<preset>|custom&start=&end=, compare=previous|none, and one
// dimension filter (country, device, landingPage or page).
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getOverview(query));
  } catch (err) {
    return metricsErrorResponse(err, "overview");
  }
}
