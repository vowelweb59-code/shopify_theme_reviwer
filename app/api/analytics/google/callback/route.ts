import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Ga4OAuthError, exchangeGa4Code } from "@/lib/analytics/googleOAuth";
import { saveConnectionFromOAuth } from "@/lib/analytics/googleConnections";
import { OAUTH_STATE_COOKIE, ga4SettingsUrl, isValidOAuthState, oauthStateCookieOptions } from "@/lib/analytics/oauthState";

// Google's documented OAuth error codes worth a specific message.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  admin_policy_enforced: "Your Google Workspace admin doesn't allow this app. Ask them to allow it, or use another account.",
  disallowed_useragent: "Google blocked sign-in from this browser. Try a regular browser window.",
  org_internal: "This Google account isn't allowed: the app's consent screen is limited to one organisation.",
  invalid_client: "The app's Google OAuth client is misconfigured (check GOOGLE_CLIENT_ID/SECRET).",
  redirect_uri_mismatch: "The GA4 callback URL isn't registered on the Google OAuth client (see the setup checklist).",
};

// GET /api/analytics/google/callback — Google redirects here with either
// ?code=&state= (consent granted) or ?error= (cancelled/denied). Always
// ends in a redirect back to Settings → GA4 Analytics with an outcome the
// page shows as a banner; never renders a raw error.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const finish = (params: Record<string, string>) => {
    const response = NextResponse.redirect(ga4SettingsUrl(request.url, params));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { ...oauthStateCookieOptions, maxAge: 0 });
    return response;
  };

  const error = searchParams.get("error");
  if (error) {
    // access_denied = the user clicked Cancel on Google's screen. Anything
    // else gets a fixed message: the raw value is attacker-controllable
    // (anyone can link here with ?error=...) and would otherwise be shown
    // on the Settings page as if it came from Google.
    if (error === "access_denied") return finish({ ga4: "cancelled" });
    return finish({ ga4: "error", ga4Error: OAUTH_ERROR_MESSAGES[error] ?? "Google couldn't complete the sign-in. Please try again." });
  }

  if (!isValidOAuthState(searchParams.get("state"), expectedState)) {
    return finish({ ga4: "error", ga4Error: "The sign-in link expired or didn't start from this app. Please connect again." });
  }

  const code = searchParams.get("code");
  if (!code) return finish({ ga4: "error", ga4Error: "Google didn't return an authorization code." });

  try {
    await connectToDatabase();
    const result = await exchangeGa4Code(code);
    const { connection, isReconnect } = await saveConnectionFromOAuth(result);
    return finish({ ga4: isReconnect ? "reconnected" : "connected", ga4Account: connection.email });
  } catch (err) {
    if (err instanceof Ga4OAuthError) return finish({ ga4: "error", ga4Error: err.message });
    console.error("[ga4] OAuth callback failed:", err instanceof Error ? err.message : err);
    return finish({ ga4: "error", ga4Error: "Something went wrong saving the connection. Please try again." });
  }
}
