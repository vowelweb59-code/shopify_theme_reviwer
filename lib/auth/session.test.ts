import { afterEach, describe, expect, it } from "vitest";
import { createSessionToken, credentialsMatch, isValidSessionToken } from "./session";
import { safeNextPath } from "./nextPath";
import { clientIp, recordFailure, recordSuccess, resetLoginRateLimit, retryAfterSeconds } from "./loginRateLimit";

const ENV = { BASIC_AUTH_USER: "team", BASIC_AUTH_PASSWORD: "secret-pass" };

describe("session tokens", () => {
  it("accepts its own token until it expires", () => {
    const now = 1_000_000;
    const token = createSessionToken(ENV, now);
    expect(isValidSessionToken(token, ENV, now + 1000)).toBe(true);
    expect(isValidSessionToken(token, ENV, now + 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects a token after the password changes, or with an edited expiry", () => {
    const token = createSessionToken(ENV);
    expect(isValidSessionToken(token, { ...ENV, BASIC_AUTH_PASSWORD: "new" })).toBe(false);
    const [v, , sig] = token.split(".");
    expect(isValidSessionToken(`${v}.${Date.now() + 10 ** 12}.${sig}`, ENV)).toBe(false);
    expect(isValidSessionToken(undefined, ENV)).toBe(false);
    expect(isValidSessionToken("garbage", ENV)).toBe(false);
  });

  it("signs with SESSION_SECRET when it's set", () => {
    const token = createSessionToken({ ...ENV, SESSION_SECRET: "s1" });
    expect(isValidSessionToken(token, { ...ENV, SESSION_SECRET: "s1" })).toBe(true);
    expect(isValidSessionToken(token, { ...ENV, SESSION_SECRET: "s2" })).toBe(false);
  });
});

describe("credentialsMatch", () => {
  it("needs both the username and the password", () => {
    expect(credentialsMatch("team", "secret-pass", ENV)).toBe(true);
    expect(credentialsMatch("team", "wrong", ENV)).toBe(false);
    expect(credentialsMatch("other", "secret-pass", ENV)).toBe(false);
    expect(credentialsMatch("", "", {})).toBe(true); // authMode keeps this unreachable: "check" needs both vars set
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and refuses anything that could leave the site", () => {
    expect(safeNextPath("/reports/1?tab=a")).toBe("/reports/1?tab=a");
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "/login?next=/x", "/api/themes", "", null]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("login rate limit", () => {
  afterEach(() => resetLoginRateLimit());

  it("locks an IP out after 5 failures for the rest of the window", () => {
    const now = 5_000_000;
    for (let i = 0; i < 5; i++) recordFailure("1.1.1.1", now);
    expect(retryAfterSeconds("1.1.1.1", now)).toBe(15 * 60);
    expect(retryAfterSeconds("2.2.2.2", now)).toBe(0);
    expect(retryAfterSeconds("1.1.1.1", now + 15 * 60 * 1000 + 1)).toBe(0);
  });

  it("clears an IP's failures when it signs in", () => {
    for (let i = 0; i < 4; i++) recordFailure("1.1.1.1");
    recordSuccess("1.1.1.1");
    recordFailure("1.1.1.1");
    expect(retryAfterSeconds("1.1.1.1")).toBe(0);
  });

  it("reads the client IP from the edge headers first", () => {
    expect(clientIp(new Headers({ "true-client-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
