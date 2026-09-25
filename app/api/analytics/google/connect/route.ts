import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId } from "@/lib/api/validation";
import { GoogleConnection } from "@/models/google-connection";
import { buildGa4AuthUrl, isGa4OAuthConfigured } from "@/lib/analytics/googleOAuth";
import { OAUTH_STATE_COOKIE, createOAuthState, ga4SettingsUrl, oauthStateCookieOptions } from "@/lib/analytics/oauthState";

// GET /api/analytics/google/connect[?connectionId=...] — starts the GA4
// consent flow. Navigated to directly (not fetched) so the browser follows
// Google's redirects. With connectionId (a reconnect), Google's account
// chooser is pre-pointed at that account's email; the user can still pick a
// different one, which then simply becomes its own connection.
export async function GET(request: Request) {
  if (!isGa4OAuthConfigured()) {
    return NextResponse.redirect(
      ga4SettingsUrl(request.url, { ga4: "error", ga4Error: "GA4 analytics isn't configured on this server yet (see .env.example)." })
    );
  }

  let loginHint: string | undefined;
  const connectionId = new URL(request.url).searchParams.get("connectionId");
  if (isValidObjectId(connectionId)) {
    await connectToDatabase();
    const existing = await GoogleConnection.findById(connectionId).select("email").lean<{ email: string }>();
    loginHint = existing?.email;
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildGa4AuthUrl({ state, loginHint }));
  response.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions);
  return response;
}
