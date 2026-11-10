import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { encryptSecret } from "@/lib/analytics/crypto";
import { isValidOAuthState } from "@/lib/analytics/oauthState";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { SERVICE_CHAT_STATE_COOKIE, serviceChatReturnUrl, serviceChatStateCookieOptions } from "@/lib/service/api/chat";
import { exchangeServiceChatCode } from "@/lib/service/chat/google";
import { ServiceChatConnection } from "@/models/service-chat";

// GET /api/service/chat/google/callback: Google returns here with ?code=&state= or ?error=. Always ends in a redirect to
// /service/chat with an outcome; never renders a raw error.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const finish = (params: Record<string, string>) => {
    const response = NextResponse.redirect(serviceChatReturnUrl(request.url, params));
    response.cookies.set(SERVICE_CHAT_STATE_COOKIE, "", { ...serviceChatStateCookieOptions, maxAge: 0 });
    return response;
  };

  // The raw ?error= value is attacker-controllable, so only access_denied gets its own outcome.
  if (searchParams.get("error")) return finish({ error: searchParams.get("error") === "access_denied" ? "Sign-in was cancelled." : "Google couldn't complete the sign-in. Please try again." });
  if (!isValidOAuthState(searchParams.get("state"), request.cookies.get(SERVICE_CHAT_STATE_COOKIE)?.value)) {
    return finish({ error: "The sign-in link expired or didn't start from this app. Please connect again." });
  }
  const code = searchParams.get("code");
  if (!code) return finish({ error: "Google didn't return an authorization code." });

  try {
    await connectToDatabase();
    const result = await exchangeServiceChatCode(code);
    const existing = await ServiceChatConnection.findOne({ key: "service-chat" }).select("+encryptedRefreshToken").lean<{ encryptedRefreshToken: string | null } | null>();
    // Google only issues a refresh token on consent; keep the stored one if this sign-in didn't return one.
    const refresh = result.refreshToken ? encryptSecret(result.refreshToken) : existing?.encryptedRefreshToken;
    if (!refresh) return finish({ error: "Google didn't return a refresh token. Remove the app's access in your Google account and connect again." });
    await ServiceChatConnection.updateOne(
      { key: "service-chat" },
      { $set: { googleAccountId: result.googleAccountId, email: result.email, status: "active", encryptedRefreshToken: refresh, scopes: result.scopes, lastError: null }, $setOnInsert: { key: "service-chat" } },
      { upsert: true }
    );
    await recordServiceAudit("chat.connect", { account: result.email });
    return finish({ connected: "1" });
  } catch (err) {
    console.error("[service-chat] OAuth callback failed:", err instanceof Error ? err.message : err);
    return finish({ error: err instanceof Error && /granted|verify|identify/.test(err.message) ? err.message : "Something went wrong saving the connection. Please try again." });
  }
}
