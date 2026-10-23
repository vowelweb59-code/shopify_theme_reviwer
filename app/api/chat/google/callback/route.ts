import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { encryptSecret } from "@/lib/analytics/crypto";
import { isValidOAuthState } from "@/lib/analytics/oauthState";
import { ChatOAuthError, exchangeChatCode } from "@/lib/chat/googleChat";
import { CHAT_STATE_COOKIE, chatReturnUrl, chatStateCookieOptions } from "@/lib/chat/oauthReturn";
import { ChatConnection } from "@/models/chat-connection";

// GET /api/chat/google/callback: Google redirects here with ?code=&state= or
// ?error=. Always ends in a redirect to the Projects page with an outcome;
// never renders a raw error.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expectedState = request.cookies.get(CHAT_STATE_COOKIE)?.value;

  const finish = (params: Record<string, string>) => {
    const response = NextResponse.redirect(chatReturnUrl(request.url, params));
    response.cookies.set(CHAT_STATE_COOKIE, "", { ...chatStateCookieOptions, maxAge: 0 });
    return response;
  };

  const error = searchParams.get("error");
  if (error) {
    // The raw value is attacker-controllable (anyone can link here with ?error=...), so only access_denied gets its own outcome.
    if (error === "access_denied") return finish({ chat: "cancelled" });
    return finish({ chat: "error", chatError: "Google couldn't complete the sign-in. Please try again." });
  }
  if (!isValidOAuthState(searchParams.get("state"), expectedState)) {
    return finish({ chat: "error", chatError: "The sign-in link expired or didn't start from this app. Please connect again." });
  }
  const code = searchParams.get("code");
  if (!code) return finish({ chat: "error", chatError: "Google didn't return an authorization code." });

  try {
    await connectToDatabase();
    const result = await exchangeChatCode(code);
    const existing = await ChatConnection.findOne({ key: "chat" }).select("+encryptedRefreshToken");
    // Google only issues a refresh token on consent; keep the stored one if this sign-in didn't return one.
    const refresh = result.refreshToken ? encryptSecret(result.refreshToken) : existing?.encryptedRefreshToken;
    if (!refresh) return finish({ chat: "error", chatError: "Google didn't return a refresh token. Remove the app's access in your Google account and connect again." });

    const sameAccount = existing?.googleAccountId === result.googleAccountId;
    await ChatConnection.updateOne(
      { key: "chat" },
      {
        $set: {
          googleAccountId: result.googleAccountId,
          email: result.email,
          status: "active",
          encryptedAccessToken: encryptSecret(result.accessToken),
          encryptedRefreshToken: refresh,
          tokenExpiresAt: result.expiryDate,
          scopes: result.scopes,
          lastError: null,
          // A different account may see different history, so start over; the same account keeps its place.
          ...(sameAccount ? {} : { lastMessageAt: null }),
        },
        $setOnInsert: { key: "chat" },
      },
      { upsert: true }
    );
    return finish({ chat: "connected", chatAccount: result.email });
  } catch (err) {
    if (err instanceof ChatOAuthError) return finish({ chat: "error", chatError: err.message });
    console.error("[chat] OAuth callback failed:", err instanceof Error ? err.message : err);
    return finish({ chat: "error", chatError: "Something went wrong saving the connection. Please try again." });
  }
}
