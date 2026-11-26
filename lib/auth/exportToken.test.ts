import { describe, expect, it } from "vitest";
import { SPACE_EXPORT_PATH, SPACE_LIST_PATH, SPACE_TARGETS_PATH, hasValidExportToken, isExportTokenRequest } from "./exportToken";

const TOKEN = "t".repeat(40);
const headers = (auth?: string) => new Headers(auth ? { authorization: auth } : {});
const req = (method: string, path: string, auth?: string) => ({ method, headers: headers(auth), nextUrl: { pathname: path } });

describe("export token", () => {
  it("accepts the right bearer token", () => {
    expect(hasValidExportToken(headers(`Bearer ${TOKEN}`), { SPACE_EXPORT_TOKEN: TOKEN })).toBe(true);
    expect(hasValidExportToken(headers(`bearer  ${TOKEN} `), { SPACE_EXPORT_TOKEN: ` ${TOKEN}\n` })).toBe(true);
  });

  it("refuses a wrong, missing or malformed token", () => {
    expect(hasValidExportToken(headers(`Bearer ${"x".repeat(40)}`), { SPACE_EXPORT_TOKEN: TOKEN })).toBe(false);
    expect(hasValidExportToken(headers(), { SPACE_EXPORT_TOKEN: TOKEN })).toBe(false);
    expect(hasValidExportToken(headers(TOKEN), { SPACE_EXPORT_TOKEN: TOKEN })).toBe(false);
    expect(hasValidExportToken(headers("Basic abc"), { SPACE_EXPORT_TOKEN: TOKEN })).toBe(false);
  });

  it("is switched off when no token is set or the token is short", () => {
    expect(hasValidExportToken(headers("Bearer short"), { SPACE_EXPORT_TOKEN: "short" })).toBe(false);
    expect(hasValidExportToken(headers("Bearer "), {})).toBe(false);
    expect(hasValidExportToken(headers(`Bearer ${TOKEN}`), {})).toBe(false);
  });

  it("opens only the three read-only paths, only for GET", () => {
    const env = { SPACE_EXPORT_TOKEN: TOKEN };
    expect(isExportTokenRequest(req("GET", SPACE_TARGETS_PATH, `Bearer ${TOKEN}`), env)).toBe(true);
    expect(isExportTokenRequest(req("POST", SPACE_TARGETS_PATH, `Bearer ${TOKEN}`), env)).toBe(false);
    expect(isExportTokenRequest(req("GET", SPACE_LIST_PATH, `Bearer ${TOKEN}`), env)).toBe(true);
    expect(isExportTokenRequest(req("POST", SPACE_LIST_PATH, `Bearer ${TOKEN}`), env)).toBe(false);
    expect(isExportTokenRequest(req("GET", SPACE_EXPORT_PATH, `Bearer ${TOKEN}`), env)).toBe(true);
    expect(isExportTokenRequest(req("POST", SPACE_EXPORT_PATH, `Bearer ${TOKEN}`), env)).toBe(false);
    expect(isExportTokenRequest(req("GET", "/api/service/space-scan", `Bearer ${TOKEN}`), env)).toBe(false);
    expect(isExportTokenRequest(req("GET", "/api/themes", `Bearer ${TOKEN}`), env)).toBe(false);
    expect(isExportTokenRequest(req("GET", `${SPACE_EXPORT_PATH}/x`, `Bearer ${TOKEN}`), env)).toBe(false);
  });
});
