import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPageFactsFromHtml, fetchHtml, fetchPageFacts } from "./fetchPageFacts";

describe("extractPageFactsFromHtml", () => {
  it("collects @type values from every JSON-LD script block", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>
        <script type="application/ld+json">{"@type":["Product","Thing"]}</script>
      </head><body></body></html>
    `;
    const facts = extractPageFactsFromHtml(html, "https://example.com");
    expect(facts.jsonLdTypes.sort()).toEqual(["Organization", "Product", "Thing"]);
  });

  it("ignores malformed JSON-LD rather than throwing", () => {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    expect(() => extractPageFactsFromHtml(html, "https://example.com")).not.toThrow();
    expect(extractPageFactsFromHtml(html, "https://example.com").jsonLdTypes).toEqual([]);
  });

  it("reads the canonical link and meta description", () => {
    const html = `
      <html><head>
        <link rel="canonical" href="https://example.com/canonical">
        <meta name="description" content="A great store">
      </head></html>
    `;
    const facts = extractPageFactsFromHtml(html, "https://example.com");
    expect(facts.canonical).toBe("https://example.com/canonical");
    expect(facts.metaDescription).toBe("A great store");
  });

  it("returns null canonical/metaDescription when absent", () => {
    const facts = extractPageFactsFromHtml("<html><head></head></html>", "https://example.com");
    expect(facts.canonical).toBeNull();
    expect(facts.metaDescription).toBeNull();
  });

  it("collects shopify-section wrapper ids with the prefix stripped", () => {
    const html = `
      <div id="shopify-section-header" class="shopify-section">header</div>
      <div id="shopify-section-hero" class="shopify-section some-other-class">hero</div>
      <div id="not-a-section" class="shopify-section">should be excluded, no matching id prefix trick</div>
    `;
    const facts = extractPageFactsFromHtml(html, "https://example.com");
    expect(facts.sectionIds).toEqual(["header", "hero"]);
  });

  it("finds the first product link and resolves it against the base URL", () => {
    const html = `<a href="/products/cool-shirt">Shop</a><a href="/products/other">Other</a>`;
    const facts = extractPageFactsFromHtml(html, "https://example.com");
    expect(facts.firstProductLink).toBe("https://example.com/products/cool-shirt");
  });

  it("returns null firstProductLink when no product link exists", () => {
    const facts = extractPageFactsFromHtml(`<a href="/collections/all">Shop</a>`, "https://example.com");
    expect(facts.firstProductLink).toBeNull();
  });
});

describe("fetchHtml", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the response text on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }) as unknown as typeof fetch;
    await expect(fetchHtml("https://example.com")).resolves.toBe("<html></html>");
  });

  it("throws immediately on a non-network, non-abort failure (e.g. a 404) without retrying", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(fetchHtml("https://example.com")).rejects.toThrow("404");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries once after a timeout (AbortError) and succeeds on the retry", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce({ ok: true, text: async () => "<html>ok</html>" });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(fetchHtml("https://example.com")).resolves.toBe("<html>ok</html>");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("fetchPageFacts", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches and parses in one call", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => '<meta name="description" content="hi">' }) as unknown as typeof fetch;
    const facts = await fetchPageFacts("https://example.com");
    expect(facts.url).toBe("https://example.com");
    expect(facts.metaDescription).toBe("hi");
  });
});
