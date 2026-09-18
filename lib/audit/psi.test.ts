import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPsiLighthouseResult, isPsiConfigured } from "./psi";

describe("isPsiConfigured", () => {
  const originalEnv = process.env.PAGESPEED_API_KEY;
  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalEnv;
  });

  it("is false when PAGESPEED_API_KEY is unset", () => {
    delete process.env.PAGESPEED_API_KEY;
    expect(isPsiConfigured()).toBe(false);
  });

  it("is true when PAGESPEED_API_KEY is set", () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    expect(isPsiConfigured()).toBe(true);
  });
});

describe("fetchPsiLighthouseResult", () => {
  const originalEnv = process.env.PAGESPEED_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null without ever calling fetch when no API key is configured", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const result = await fetchPsiLighthouseResult("https://example.com");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the full lighthouseResult object from a real-shaped PSI response", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const lighthouseResult = {
      categories: { performance: { score: 0.87 } },
      audits: { "largest-contentful-paint": { score: 1, numericValue: 2100 } },
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult }) }) as unknown as typeof fetch;

    const result = await fetchPsiLighthouseResult("https://example.com");
    expect(result).toEqual(lighthouseResult);
  });

  it("returns null when the PSI request fails", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await fetchPsiLighthouseResult("https://example.com")).toBeNull();
  });

  it("returns null when fetch throws (e.g. timeout/network error)", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as unknown as typeof fetch;
    expect(await fetchPsiLighthouseResult("https://example.com")).toBeNull();
  });

  it("retries once after a failure and returns the retry's result", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const lighthouseResult = { categories: { performance: { score: 0.5 } } };
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lighthouseResult }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchPsiLighthouseResult("https://example.com");
    expect(result).toEqual(lighthouseResult);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a second time when both attempts fail", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network error"));
    global.fetch = fetchSpy as unknown as typeof fetch;

    expect(await fetchPsiLighthouseResult("https://example.com")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the first attempt succeeds", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const lighthouseResult = { categories: { performance: { score: 0.9 } } };
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPsiLighthouseResult("https://example.com");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("passes strategy and repeats category once per requested category", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult: {} }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPsiLighthouseResult("https://example.com", "desktop", ["performance", "accessibility"]);

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("strategy")).toBe("desktop");
    expect(calledUrl.searchParams.getAll("category")).toEqual(["performance", "accessibility"]);
  });

  it("defaults to mobile strategy and performance-only category", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult: {} }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPsiLighthouseResult("https://example.com");

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("strategy")).toBe("mobile");
    expect(calledUrl.searchParams.getAll("category")).toEqual(["performance"]);
  });
});
