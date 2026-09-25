import { NextResponse } from "next/server";
import { ThemeRequestError } from "./themes";
import { SyncRequestError } from "./sync/runSync";
import { MetricsRequestError } from "./engine/params";

// Shared catch block for the GA4 theme and sync routes: known request errors become
// their status + message; anything else is logged (message only, never a
// Google response body) and answered with a generic 500.
export function themeErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof ThemeRequestError || err instanceof SyncRequestError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[ga4] ${context} failed:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

// Same, for the metrics routes: bad query parameters are 400s, an unknown
// theme a 404; anything else is logged and answered generically.
export function metricsErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof MetricsRequestError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[ga4-engine] ${context} failed:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Couldn't load analytics. Please try again." }, { status: 500 });
}
