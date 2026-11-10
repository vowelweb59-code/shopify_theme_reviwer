import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/analytics/oauthState";
import { SERVICE_CHAT_STATE_COOKIE, serviceChatReturnUrl, serviceChatStateCookieOptions } from "@/lib/service/api/chat";
import { isServiceChatConfigured, serviceChatAuthUrl } from "@/lib/service/chat/google";

// GET /api/service/chat/google/connect: starts the Google consent flow for reading TIMER STATUS. Navigated to (not fetched),
// so the browser follows Google's redirects.
export async function GET(request: Request) {
  if (!isServiceChatConfigured()) {
    return NextResponse.redirect(serviceChatReturnUrl(request.url, { error: "Google Chat isn't configured on this server (GOOGLE_CLIENT_ID/SECRET, ANALYTICS_TOKEN_ENCRYPTION_KEY, APP_URL)." }));
  }
  const state = createOAuthState();
  const response = NextResponse.redirect(serviceChatAuthUrl(state));
  response.cookies.set(SERVICE_CHAT_STATE_COOKIE, state, serviceChatStateCookieOptions);
  return response;
}
