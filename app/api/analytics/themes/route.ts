import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { createTheme, listThemes } from "@/lib/analytics/themes";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";
import { kickOffSyncAfterMapping } from "@/lib/analytics/sync/kickoff";

// GET /api/analytics/themes — every GA4 theme with its account + property.
export async function GET() {
  await connectToDatabase();
  return NextResponse.json({ themes: await listThemes() });
}

// POST /api/analytics/themes — { name, googleConnectionId?, ga4PropertyId? }.
// With a mapping, the account must prove it can read the property first;
// nothing is saved if that check fails. A mapped theme's first sync
// (its full GA4 history) starts in the background straight away.
export async function POST(request: Request) {
  await connectToDatabase();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  try {
    const theme = await createTheme(body);
    if (theme.connectionStatus === "connected") kickOffSyncAfterMapping(theme.id);
    return NextResponse.json({ theme }, { status: 201 });
  } catch (err) {
    return themeErrorResponse(err, "create theme");
  }
}
