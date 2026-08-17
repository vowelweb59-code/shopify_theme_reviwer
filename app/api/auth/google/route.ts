import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

// GET /api/auth/google — starts the Sheets-export OAuth consent flow.
// Navigated to directly (not fetched) so the browser follows Google's
// redirect chain.
export async function GET(request: Request) {
  try {
    return NextResponse.redirect(getGoogleAuthUrl());
  } catch (err) {
    // Most likely GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI aren't set yet —
    // send the user back to Settings with a clear reason rather than a
    // raw 500, same idiom as the callback route below.
    const settingsUrl = new URL("/settings", new URL(request.url).origin);
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("googleError", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(settingsUrl);
  }
}
