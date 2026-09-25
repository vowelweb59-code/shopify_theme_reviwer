import { afterEach, describe, expect, it, vi } from "vitest";
import { createOAuthState, ga4SettingsUrl, isValidOAuthState } from "./oauthState";

describe("OAuth state", () => {
  it("accepts only an exact match with the cookie", () => {
    const state = createOAuthState();
    expect(isValidOAuthState(state, state)).toBe(true);
    expect(isValidOAuthState(state, createOAuthState())).toBe(false);
    expect(isValidOAuthState(state.slice(1), state)).toBe(false);
  });

  it("rejects a missing state or cookie (e.g. a forged or expired callback)", () => {
    expect(isValidOAuthState(null, "x")).toBe(false);
    expect(isValidOAuthState("x", undefined)).toBe(false);
  });

  it("is unpredictable", () => {
    expect(createOAuthState()).not.toBe(createOAuthState());
    expect(createOAuthState().length).toBeGreaterThanOrEqual(32);
  });
});

describe("ga4SettingsUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses APP_URL over the request origin (Render's proxy can expose an internal host)", () => {
    vi.stubEnv("APP_URL", "https://shopify-theme-reviwer.onrender.com");
    const url = ga4SettingsUrl("http://localhost:10000/api/analytics/google/callback?code=x", { ga4: "connected" });
    expect(url.toString()).toBe("https://shopify-theme-reviwer.onrender.com/settings?tab=analytics&ga4=connected");
  });

  it("falls back to the request origin", () => {
    vi.stubEnv("APP_URL", "");
    expect(ga4SettingsUrl("http://localhost:3000/api/x", { ga4: "cancelled" }).origin).toBe("http://localhost:3000");
  });
});
