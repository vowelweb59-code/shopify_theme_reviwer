import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getOverview } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/overview — headline KPIs (users, Theme Views,
// Try Theme, installs) and conversion rates, current vs previous period.
// Query: theme=all|<id|slug>, range=<preset>|custom&start=&end=,
// compare=previous|none, events=<extra tracked events>, and dimension
// filters (country, city, device, browser, os, source, medium, campaign,
// landingPage, page) from one family at a time.
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getOverview(query));
  } catch (err) {
    return metricsErrorResponse(err, "overview");
  }
}
