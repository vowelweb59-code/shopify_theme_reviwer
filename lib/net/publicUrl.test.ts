import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockedUrlError, assertPublicUrl, fetchPublicText, isBlockedAddress } from "./publicUrl";

const publicDns = async () => [{ address: "93.184.216.34" }];

describe("isBlockedAddress", () => {
  it("blocks loopback, private, link-local, metadata, CGNAT and IPv6 local ranges", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "64:ff9b::a00:1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["93.184.216.34", "23.227.38.65", "2606:4700::6810:84e5"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("accepts a public http(s) URL", async () => {
    await expect(assertPublicUrl("https://store.myshopify.com/", publicDns)).resolves.toBeInstanceOf(URL);
  });

  it("refuses private hosts, IP literals, other schemes and embedded credentials", async () => {
    for (const bad of ["http://localhost:3000/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "ftp://example.com/", "https://user:pw@example.com/", "not a url"]) {
      await expect(assertPublicUrl(bad, publicDns), bad).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });

  it("refuses a public-looking name that resolves to a private address", async () => {
    await expect(assertPublicUrl("https://evil.example/", async () => [{ address: "93.184.216.34" }, { address: "10.0.0.5" }])).rejects.toThrow("private address");
  });
});

describe("fetchPublicText", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const response = (status: number, body = "", headers: Record<string, string> = {}) =>
    new Response(status >= 300 && status < 400 ? null : body, { status, headers });

  it("follows a redirect to another public host", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(response(302, "", { location: "https://www.example.com/home" })).mockResolvedValueOnce(response(200, "<html>ok</html>"));
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(fetchPublicText("https://example.com/", { timeoutMs: 1000, resolve: publicDns })).resolves.toBe("<html>ok</html>");
    expect(String(fetchSpy.mock.calls[1][0])).toBe("https://www.example.com/home");
  });

  it("refuses a redirect into the private network before requesting it", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(response(302, "", { location: "http://169.254.169.254/latest/meta-data/" }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(fetchPublicText("https://example.com/", { timeoutMs: 1000, resolve: publicDns })).rejects.toBeInstanceOf(BlockedUrlError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    global.fetch = vi.fn().mockImplementation(async () => response(301, "", { location: "https://example.com/again" })) as unknown as typeof fetch;
    await expect(fetchPublicText("https://example.com/", { timeoutMs: 1000, maxRedirects: 2, resolve: publicDns })).rejects.toThrow("Too many redirects");
  });

  it("cuts off a body larger than maxBytes", async () => {
    global.fetch = vi.fn().mockResolvedValue(response(200, "x".repeat(2048))) as unknown as typeof fetch;
    await expect(fetchPublicText("https://example.com/", { timeoutMs: 1000, maxBytes: 1024, resolve: publicDns })).rejects.toThrow("larger than");
  });
});
