import { NextResponse } from "next/server";
import { SHEETS_OAUTH_STATE_COOKIE, getGoogleAuthUrl, sheetsOAuthStateCookieOptions } from "@/lib/google/oauth";
import { createOAuthState } from "@/lib/analytics/oauthState";

// GET /api/auth/google — starts the Sheets-export OAuth consent flow.
// Navigated to directly (not fetched) so the browser follows Google's
// redirect chain. A random `state` goes to Google and into a short-lived
// cookie; the callback only accepts a code that comes back with the same
// value, so nobody can connect their own Google account through a link.
export async function GET(request: Request) {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(getGoogleAuthUrl(state));
    response.cookies.set(SHEETS_OAUTH_STATE_COOKIE, state, sheetsOAuthStateCookieOptions);
    return response;
  } catch (err) {
    // Most likely GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI aren't set yet.
    console.error("[google-sheets] starting OAuth failed:", err instanceof Error ? err.message : err);
    const settingsUrl = new URL("/settings", new URL(request.url).origin);
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("googleError", "Google Sheets export isn't configured on this server.");
    return NextResponse.redirect(settingsUrl);
  }
}
