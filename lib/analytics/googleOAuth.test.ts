import { describe, expect, it, vi } from "vitest";
import type { OAuth2Client } from "google-auth-library";
import {
  ANALYTICS_READONLY_SCOPE,
  Ga4OAuthError,
  buildGa4AuthUrl,
  classifyRefreshError,
  createGa4OAuthClient,
  exchangeGa4Code,
  getGa4RedirectUri,
  isGa4OAuthConfigured,
} from "./googleOAuth";

const env = {
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
  APP_URL: "https://shopify-theme-reviwer.onrender.com/",
  ANALYTICS_TOKEN_ENCRYPTION_KEY: "x",
};

const googleError = (error: string) => Object.assign(new Error(error), { response: { data: { error } } });

// A stand-in OAuth2Client: just the methods exchangeGa4Code calls.
function fakeClient({ tokens, payload, getTokenError }: { tokens?: Record<string, unknown>; payload?: Record<string, unknown> | null; getTokenError?: Error }) {
  return {
    _clientId: env.GOOGLE_CLIENT_ID,
    getToken: vi.fn(async () => {
      if (getTokenError) throw getTokenError;
      return { tokens };
    }),
    verifyIdToken: vi.fn(async () => {
      if (!payload) throw new Error("bad signature");
      return { getPayload: () => payload };
    }),
  } as unknown as OAuth2Client;
}

const goodTokens = {
  access_token: "access",
  refresh_token: "refresh",
  expiry_date: Date.parse("2026-09-25T12:00:00Z"),
  id_token: "id-token",
  scope: `openid https://www.googleapis.com/auth/userinfo.email ${ANALYTICS_READONLY_SCOPE}`,
};

describe("configuration", () => {
  it("derives the callback from APP_URL, trimming a trailing slash", () => {
    expect(getGa4RedirectUri(env)).toBe("https://shopify-theme-reviwer.onrender.com/api/analytics/google/callback");
  });

  it("prefers an explicit GA4_OAUTH_REDIRECT_URI", () => {
    expect(getGa4RedirectUri({ ...env, GA4_OAUTH_REDIRECT_URI: "http://localhost:3000/cb" })).toBe("http://localhost:3000/cb");
  });

  it("reports unconfigured when any required var is missing", () => {
    expect(isGa4OAuthConfigured(env)).toBe(true);
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ANALYTICS_TOKEN_ENCRYPTION_KEY", "APP_URL"] as const) {
      expect(isGa4OAuthConfigured({ ...env, [key]: undefined })).toBe(false);
    }
    expect(() => getGa4RedirectUri({})).toThrow(Ga4OAuthError);
  });
});

describe("buildGa4AuthUrl", () => {
  const url = new URL(buildGa4AuthUrl({ state: "abc123", loginHint: "owner@example.com" }, createGa4OAuthClient(env)));

  it("asks for offline, read-only analytics access with the account chooser", () => {
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("select_account consent");
    expect(url.searchParams.get("scope")?.split(" ")).toContain(ANALYTICS_READONLY_SCOPE);
    expect(url.searchParams.get("scope")).not.toMatch(/analytics\.edit|spreadsheets|drive/);
  });

  it("carries the CSRF state, the login hint and the GA4 callback", () => {
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("login_hint")).toBe("owner@example.com");
    expect(url.searchParams.get("redirect_uri")).toBe(getGa4RedirectUri(env));
  });
});

describe("exchangeGa4Code", () => {
  it("returns the verified identity and tokens", async () => {
    const result = await exchangeGa4Code("code", fakeClient({ tokens: goodTokens, payload: { sub: "1001", email: "a@example.com", name: "Account A" } }));
    expect(result).toMatchObject({ googleAccountId: "1001", email: "a@example.com", displayName: "Account A", accessToken: "access", refreshToken: "refresh" });
    expect(result.scopes).toContain(ANALYTICS_READONLY_SCOPE);
  });

  it("rejects a sign-in where the Analytics scope was unticked", async () => {
    const tokens = { ...goodTokens, scope: "openid https://www.googleapis.com/auth/userinfo.email" };
    await expect(exchangeGa4Code("code", fakeClient({ tokens, payload: { sub: "1", email: "a@x.com" } }))).rejects.toMatchObject({ code: "missing_scope" });
  });

  it("rejects an unverifiable identity", async () => {
    await expect(exchangeGa4Code("code", fakeClient({ tokens: goodTokens, payload: null }))).rejects.toMatchObject({ code: "invalid_identity" });
    await expect(exchangeGa4Code("code", fakeClient({ tokens: { ...goodTokens, id_token: undefined }, payload: {} }))).rejects.toMatchObject({ code: "invalid_identity" });
  });

  it("turns a rejected code into a safe message without Google's raw body", async () => {
    const err = await exchangeGa4Code("used-code", fakeClient({ getTokenError: googleError("invalid_grant") })).catch((e) => e);
    expect(err).toMatchObject({ code: "token_exchange_failed" });
    expect(err.message).toContain("invalid_grant");
  });

  it("passes a missing refresh token through as null (the caller decides)", async () => {
    const result = await exchangeGa4Code("code", fakeClient({ tokens: { ...goodTokens, refresh_token: undefined }, payload: { sub: "1", email: "a@x.com" } }));
    expect(result.refreshToken).toBeNull();
  });
});

describe("classifyRefreshError", () => {
  it("treats invalid_grant as revoked", () => expect(classifyRefreshError(googleError("invalid_grant"))).toBe("revoked"));
  it("treats a bad client as config", () => expect(classifyRefreshError(googleError("invalid_client"))).toBe("config"));
  it("treats network failures as transient", () => expect(classifyRefreshError(new Error("ECONNRESET"))).toBe("transient"));
});
