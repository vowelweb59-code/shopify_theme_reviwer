import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicText } from "./fetchPublic";

const reply = (status: number, body = "") => ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

afterEach(() => vi.restoreAllMocks());

describe("fetchPublicText", () => {
  it("returns the body and sends a browser User-Agent", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(200, "<html>"));
    expect(await fetchPublicText("https://x.test/")).toBe("<html>");
    expect((f.mock.calls[0][1]?.headers as Record<string, string>)["User-Agent"]).toMatch(/Mozilla/);
  });
  it("waits and retries a 429, then gives up after the last attempt", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200, "ok"));
    expect(await fetchPublicText("https://x.test/", { rateLimitWaitMs: 1 })).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(429));
    await expect(fetchPublicText("https://x.test/", { attempts: 2, rateLimitWaitMs: 1 })).rejects.toThrow(/HTTP 429/);
  });
  it("gives null for a 404 or a redirect only when asked, and throws otherwise", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(404));
    expect(await fetchPublicText("https://x.test/", { nullOn404: true })).toBeNull();
    await expect(fetchPublicText("https://x.test/")).rejects.toThrow(/HTTP 404/);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(302));
    expect(await fetchPublicText("https://x.test/", { redirect: "manual", nullOnRedirect: true })).toBeNull();
  });
});
