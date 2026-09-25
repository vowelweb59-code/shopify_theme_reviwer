import { describe, expect, it } from "vitest";
import { isCrossSiteMutation } from "./proxy";

const req = (method: string, path: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers({ host: "shopify-theme-reviwer.onrender.com", ...headers }),
  nextUrl: new URL(`http://shopify-theme-reviwer.onrender.com${path}`),
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
