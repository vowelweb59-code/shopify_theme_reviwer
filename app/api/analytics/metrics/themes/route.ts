import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getThemeComparison } from "@/lib/analytics/engine/metrics";
import { parseMetricsQuery } from "@/lib/analytics/engine/params";
import { metricsErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/metrics/themes — one KPI row per theme (the theme
// comparison table) plus the All Themes total. Same query as /overview;
// theme=<id|slug> narrows it to one row.
export async function GET(request: Request) {
  try {
    const query = parseMetricsQuery(new URL(request.url).searchParams);
    await connectToDatabase();
    return NextResponse.json(await getThemeComparison(query));
  } catch (err) {
    return metricsErrorResponse(err, "themes");
  }
}
