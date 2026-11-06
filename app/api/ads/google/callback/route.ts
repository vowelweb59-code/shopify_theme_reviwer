import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { encryptSecret } from "@/lib/analytics/crypto";
import { isValidOAuthState } from "@/lib/analytics/oauthState";
import { ADS_STATE_COOKIE, AdsOAuthError, adsStateCookieOptions, exchangeAdsCode } from "@/lib/ads/googleAds";
import { adsReturnUrl } from "@/lib/ads/oauthReturn";
import { AdsConnection } from "@/models/ads-connection";

// GET /api/ads/google/callback: Google redirects here with ?code=&state= or ?error=. Always ends in a redirect to the Google Ads tab.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expectedState = request.cookies.get(ADS_STATE_COOKIE)?.value;
  const finish = (params: Record<string, string>) => {
    const response = NextResponse.redirect(adsReturnUrl(request.url, params));
    response.cookies.set(ADS_STATE_COOKIE, "", { ...adsStateCookieOptions, maxAge: 0 });
    return response;
  };

  const error = searchParams.get("error");
  if (error) {
    // Only access_denied gets its own outcome: the raw value is attacker-controllable.
    if (error === "access_denied") return finish({ ads: "cancelled" });
    return finish({ ads: "error", adsError: "Google couldn't complete the sign-in. Please try again." });
  }
  if (!isValidOAuthState(searchParams.get("state"), expectedState)) return finish({ ads: "error", adsError: "The sign-in link expired or didn't start from this app. Please connect again." });
  const code = searchParams.get("code");
  if (!code) return finish({ ads: "error", adsError: "Google didn't return an authorization code." });

  try {
    await connectToDatabase();
    const result = await exchangeAdsCode(code);
    const existing = await AdsConnection.findOne({ key: "ads" }).select("+encryptedRefreshToken");
    const refresh = result.refreshToken ? encryptSecret(result.refreshToken) : existing?.encryptedRefreshToken;
    if (!refresh) return finish({ ads: "error", adsError: "Google didn't return a refresh token. Remove the app's access in your Google account and connect again." });
    await AdsConnection.updateOne(
      { key: "ads" },
      {
        $set: { googleAccountId: result.googleAccountId, email: result.email, status: "active", encryptedAccessToken: encryptSecret(result.accessToken), encryptedRefreshToken: refresh, tokenExpiresAt: result.expiryDate, scopes: result.scopes, lastError: null },
        $setOnInsert: { key: "ads" },
      },
      { upsert: true }
    );
    return finish({ ads: "connected", adsAccount: result.email });
  } catch (err) {
    if (err instanceof AdsOAuthError) return finish({ ads: "error", adsError: err.message });
    console.error("[ads] OAuth callback failed:", err instanceof Error ? err.message : err);
    return finish({ ads: "error", adsError: "Something went wrong saving the connection. Please try again." });
  }
}
