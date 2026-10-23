import { NextResponse } from "next/server";
import { buildChatAuthUrl, isChatConfigured } from "@/lib/chat/googleChat";
import { CHAT_STATE_COOKIE, chatReturnUrl, chatStateCookieOptions } from "@/lib/chat/oauthReturn";
import { createOAuthState } from "@/lib/analytics/oauthState";

// GET /api/chat/google/connect: starts the Google Chat consent flow. Navigated
// to directly (not fetched) so the browser follows Google's redirects.
export async function GET(request: Request) {
  if (!isChatConfigured()) {
    return NextResponse.redirect(chatReturnUrl(request.url, { chat: "error", chatError: "Google Chat isn't configured on this server (GOOGLE_CLIENT_ID/SECRET, ANALYTICS_TOKEN_ENCRYPTION_KEY, APP_URL)." }));
  }
  const state = createOAuthState();
  const response = NextResponse.redirect(buildChatAuthUrl(state));
  response.cookies.set(CHAT_STATE_COOKIE, state, chatStateCookieOptions);
  return response;
}
