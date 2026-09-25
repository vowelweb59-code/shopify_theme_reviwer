import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getBreakdown } from "@/lib/analytics/engine/metrics";
import { parseBreakdownQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/breakdown — KPIs per value of one dimension.
// Query: everything /overview takes, plus dimension=<country|city|device|
// browser|os|source|medium|campaign|channel|landingPage|page>, sort=<users|
// sessions|themeViews|tryTheme|installs|tryThemeRate|installRate>,
// order=asc|desc, limit (max 100), offset.
export async function GET(request: Request) {
  try {
    const query = parseBreakdownQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getBreakdown(query));
  } catch (err) {
    return metricsErrorResponse(err, "breakdown");
  }
}
