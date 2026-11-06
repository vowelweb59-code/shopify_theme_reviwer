import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/analytics/oauthState";
import { ADS_STATE_COOKIE, adsStateCookieOptions, buildAdsAuthUrl, isAdsConfigured } from "@/lib/ads/googleAds";
import { adsReturnUrl } from "@/lib/ads/oauthReturn";

// GET /api/ads/google/connect: starts the Google Ads consent flow (navigated to, not fetched).
export async function GET(request: Request) {
  if (!isAdsConfigured()) {
    return NextResponse.redirect(adsReturnUrl(request.url, { ads: "error", adsError: "Google Ads isn't configured on this server (GOOGLE_CLIENT_ID/SECRET, ANALYTICS_TOKEN_ENCRYPTION_KEY, APP_URL)." }));
  }
  const state = createOAuthState();
  const response = NextResponse.redirect(buildAdsAuthUrl(state));
  response.cookies.set(ADS_STATE_COOKIE, state, adsStateCookieOptions);
  return response;
}
