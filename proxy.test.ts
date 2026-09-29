import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { authMode, isCrossSiteMutation, proxy } from "./proxy";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "@/lib/auth/session";

const req = (method: string, path: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers({ host: "shopify-theme-reviwer.onrender.com", ...headers }),
  nextUrl: new URL(`http://shopify-theme-reviwer.onrender.com${path}`),
});

describe("authMode", () => {
  it("checks credentials whenever both are set", () => {
    expect(authMode({ NODE_ENV: "production", BASIC_AUTH_USER: "u", BASIC_AUTH_PASSWORD: "p" })).toBe("check");
    expect(authMode({ NODE_ENV: "development", BASIC_AUTH_USER: "u", BASIC_AUTH_PASSWORD: "p" })).toBe("check");
  });

  it("refuses access in production when a credential is missing", () => {
    expect(authMode({ NODE_ENV: "production" })).toBe("misconfigured");
    expect(authMode({ NODE_ENV: "production", BASIC_AUTH_USER: "u" })).toBe("misconfigured");
  });

  it("stays open in local dev, or in production only when disabled on purpose", () => {
    expect(authMode({ NODE_ENV: "development" })).toBe("open");
    expect(authMode({ NODE_ENV: "production", BASIC_AUTH_DISABLED: "1" })).toBe("open");
  });
});

describe("isCrossSiteMutation", () => {
  it("blocks mutating API calls a browser marks as cross-site or same-site", () => {
    expect(isCrossSiteMutation(req("POST", "/api/analytics/google/connections/x/disconnect", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteMutation(req("PATCH", "/api/analytics/themes/x", { "sec-fetch-site": "same-site" }))).toBe(true);
  });

  it("blocks a foreign or opaque Origin", () => {
    expect(isCrossSiteMutation(req("POST", "/api/themes", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteMutation(req("POST", "/api/themes", { origin: "null" }))).toBe(true);
  });

  it("allows the app's own pages, ignoring http vs https behind the TLS proxy", () => {
    expect(isCrossSiteMutation(req("POST", "/api/themes", { "sec-fetch-site": "same-origin", origin: "https://shopify-theme-reviwer.onrender.com" }))).toBe(false);
  });

  it("allows non-browser clients (no Origin, no Sec-Fetch-Site)", () => {
    expect(isCrossSiteMutation(req("POST", "/api/audit/run"))).toBe(false);
  });

  it("never blocks reads or non-API pages", () => {
    expect(isCrossSiteMutation(req("GET", "/api/analytics/metrics/overview", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isCrossSiteMutation(req("POST", "/settings", { "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("honours the proxied host", () => {
    expect(isCrossSiteMutation(req("POST", "/api/themes", { host: "10.0.0.5:10000", "x-forwarded-host": "app.example.com", origin: "https://app.example.com" }))).toBe(false);
  });
});

describe("proxy login gate", () => {
  const ENV = { BASIC_AUTH_USER: "team", BASIC_AUTH_PASSWORD: "correct horse battery" };
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  function run(path: string, init: { cookie?: string; method?: string } = {}) {
    Object.assign(process.env, ENV);
    const headers = new Headers();
    if (init.cookie) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
    return proxy(new NextRequest(`https://app.example.com${path}`, { method: init.method ?? "GET", headers }));
  }

  it("sends a signed-out page visit to /login, remembering where it was going", () => {
    const res = run("/reports/abc?tab=seo");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/reports/abc?tab=seo");
  });

  it("answers a signed-out API call with 401 JSON, never a Basic Auth popup", async () => {
    const res = run("/api/themes");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBeNull();
    expect(await res.json()).toEqual({ error: "Sign in required." });
  });

  it("lets the login page and sign-in endpoint through without a session", () => {
    expect(run("/login").headers.get("x-middleware-next")).toBe("1");
    expect(run("/api/session", { method: "POST" }).headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a valid session through and bounces it off /login", () => {
    Object.assign(process.env, ENV);
    const token = createSessionToken(process.env);
    expect(run("/themes", { cookie: token }).headers.get("x-middleware-next")).toBe("1");
    expect(new URL(run("/login", { cookie: token }).headers.get("location")!).pathname).toBe("/");
  });

  it("rejects a forged, expired or other-password session", () => {
    Object.assign(process.env, ENV);
    const expired = createSessionToken(process.env, Date.now() - SESSION_TTL_MS - 1000);
    const otherPassword = createSessionToken({ ...ENV, BASIC_AUTH_PASSWORD: "old password" });
    expect(run("/themes", { cookie: expired }).status).toBe(307);
    expect(run("/themes", { cookie: otherPassword }).status).toBe(307);
    expect(run("/themes", { cookie: `v1.${Date.now() + 99999999}.forged` }).status).toBe(307);
  });
});
