import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SHEETS_OAUTH_STATE_COOKIE, exchangeCodeForTokens, saveGoogleConnection, sheetsOAuthStateCookieOptions } from "@/lib/google/oauth";
import { isValidOAuthState } from "@/lib/analytics/oauthState";

// Google's own ?error= values the Settings page can show as-is; anything
// else becomes a generic message (never echo arbitrary text into the URL).
const KNOWN_GOOGLE_ERRORS = new Set(["access_denied", "invalid_scope", "server_error", "temporarily_unavailable"]);

// GET /api/auth/google/callback — Google redirects here with either
// ?code=... (consent granted) or ?error=... (denied/cancelled). The code is
// only used when `state` matches the cookie set by /api/auth/google, so a
// link carrying someone else's code can't swap in their Google account.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const settingsUrl = new URL("/settings", origin);
  const finish = (params: Record<string, string>) => {
    for (const [k, v] of Object.entries(params)) settingsUrl.searchParams.set(k, v);
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set(SHEETS_OAUTH_STATE_COOKIE, "", { ...sheetsOAuthStateCookieOptions, maxAge: 0 });
    return response;
  };
  const fail = (message: string) => finish({ google: "error", googleError: message });

  if (!isValidOAuthState(searchParams.get("state"), request.cookies.get(SHEETS_OAUTH_STATE_COOKIE)?.value)) {
    return fail("The Google sign-in link expired or didn't start here. Click Connect again.");
  }

  const error = searchParams.get("error");
  if (error) return fail(KNOWN_GOOGLE_ERRORS.has(error) ? error : "Google returned an error.");

  const code = searchParams.get("code");
  if (!code) return fail("missing_code");

  try {
    await connectToDatabase();
    await saveGoogleConnection(await exchangeCodeForTokens(code));
  } catch (err) {
    console.error("[google-sheets] OAuth callback failed:", err instanceof Error ? err.message : err);
    return fail("Couldn't finish connecting Google. Try disconnecting and reconnecting.");
  }

  return finish({ google: "connected" });
}
