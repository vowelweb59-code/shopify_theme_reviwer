import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveThemeStoreSlug, fetchPresetDemoStoreUrls, fetchThemeStoreFeatureLabels } from "./themeStoreFeatures";

describe("deriveThemeStoreSlug", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(deriveThemeStoreSlug("Adorn")).toBe("adorn");
  });

  it("collapses spaces and punctuation into single hyphens", () => {
    expect(deriveThemeStoreSlug("Sense - Bold & Modern")).toBe("sense-bold-modern");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(deriveThemeStoreSlug("  Warehouse!  ")).toBe("warehouse");
  });
});

// A trimmed real fixture matching themes.shopify.com's actual markup
// (confirmed against a real listing page) — a mobile-accordion <details>
// block with an <h3> category heading and a <ul> of
// `<span class="tw-mr-sm">Label</span>` feature names.
const REAL_SHAPE_HTML = `
  <div id="features">
    <details>
      <h3>Cart and checkout</h3>
      <ul>
        <li><span class="tw-mr-sm">
  Cart notes
</span></li>
        <li><span class="tw-mr-sm">
  Gift wrapping
</span></li>
      </ul>
    </details>
    <details>
      <h3>Marketing and conversion</h3>
      <ul>
        <li><span class="tw-mr-sm">
  Trust badges
</span></li>
      </ul>
    </details>
  </div>
  <div id="style-variants">
    <a href="https://themes.shopify.com/themes/adorn/presets/adorn" aria-label="View Adorn"><picture></picture></a>
    <a href="https://themes.shopify.com/themes/adorn/presets/adorn" aria-label="View Adorn"><span>Adorn</span></a>
    <a href="https://themes.shopify.com/themes/adorn/presets/ace" aria-label="View Ace"><picture></picture></a>
    <a href="https://themes.shopify.com/themes/adorn/presets/ace" aria-label="View Ace"><span>Ace</span></a>
    <a href="https://themes.shopify.com/themes/adorn/presets/adorn/reviews" aria-label="Read reviews">reviews</a>
    <a href="https://themes.shopify.com/themes/adorn/presets/adorn?locale=fr">locale switcher, no aria-label</a>
  </div>
  <div data-testid="reviews__ratings">
    <span class="tw-text-heading-3xl tw-font-body" role="note">97% positive</span>
    <span class="tw-text-body-lg tw-text-fg-secondary" role="note">29 reviews</span>
  </div>
  <div id="ReleaseNotes">
    <div class="tw-flex tw-flex-col tw-gap-xs">
      <div class="tw-flex tw-flex-row tw-gap-xs tw-text-body-lg tw-text-fg-primary">
          <h3>Version 2.3.6</h3>
          <span class="tw-text-fg-disabled">•</span>
          <span> August 18, 2026</span>
      </div>
      <div class="tw-text-body-lg tw-text-fg-secondary">
        <p>Bug fixes and performance improvements.</p>
      </div>
    </div>
  </div>
`;

describe("fetchThemeStoreFeatureLabels", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts every feature label from a real-shaped listing page", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => REAL_SHAPE_HTML }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe("adorn");
      expect(result.features.sort()).toEqual(["Cart notes", "Gift wrapping", "Trust badges"]);
    }
  });

  it("extracts each named style preset, deduping repeated links to the same slug", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => REAL_SHAPE_HTML }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presets).toEqual([
        { slug: "adorn", name: "Adorn" },
        { slug: "ace", name: "Ace" },
      ]);
    }
  });

  it("extracts the review count and percent-positive score", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => REAL_SHAPE_HTML }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reviewCount).toBe(29);
      expect(result.positivePercent).toBe(97);
    }
  });

  it("returns null review stats when the page has no reviews summary block", async () => {
    const html = `<div id="features"><span class="tw-mr-sm">Cart notes</span></div>`;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => html }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reviewCount).toBeNull();
      expect(result.positivePercent).toBeNull();
    }
  });

  it("extracts the current live version and its release date from the Release Notes section", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => REAL_SHAPE_HTML }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latestVersion).toBe("2.3.6");
      expect(result.latestVersionReleasedAt).toBe("August 18, 2026");
    }
  });

  it("returns null latest version/date when the page has no Release Notes section", async () => {
    const html = `<div id="features"><span class="tw-mr-sm">Cart notes</span></div>`;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => html }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latestVersion).toBeNull();
      expect(result.latestVersionReleasedAt).toBeNull();
    }
  });

  it("fetches the slug-derived URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => REAL_SHAPE_HTML });
    global.fetch = fetchSpy as unknown as typeof fetch;
    await fetchThemeStoreFeatureLabels("Sense");
    expect(fetchSpy).toHaveBeenCalledWith("https://themes.shopify.com/themes/sense", expect.anything());
  });

  it("returns ok:false with a clear error when the listing doesn't exist (non-ok response)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Not A Real Theme");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("404");
  });

  it("returns ok:false when the page has no recognizable Features section", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html><body>no features here</body></html>" }) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when fetch throws (network error/timeout)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as unknown as typeof fetch;
    const result = await fetchThemeStoreFeatureLabels("Adorn");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("network error");
  });
});

// A trimmed real fixture matching a preset's own listing page (confirmed
// against a real page, e.g. themes.shopify.com/themes/gravity/presets/decor)
// — the embedded storefront preview's controller element carrying the
// preset's live demo store URL.
function presetPageHtml(demoUrl: string) {
  return `<section id="demo-container" data-controller="demo-store" data-demo-store-iframe-url-value="${demoUrl}"></section>`;
}

describe("fetchPresetDemoStoreUrls", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches each preset's own page and extracts its demo store URL", async () => {
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      text: async () => presetPageHtml(`https://${url.includes("/presets/decor") ? "decor-demo" : "gravity-demo"}.myshopify.com/`),
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const results = await fetchPresetDemoStoreUrls("gravity", [
      { slug: "gravity", name: "Gravity" },
      { slug: "decor", name: "Decor" },
    ]);

    expect(results).toEqual([
      { slug: "gravity", name: "Gravity", url: "https://gravity-demo.myshopify.com/", error: undefined },
      { slug: "decor", name: "Decor", url: "https://decor-demo.myshopify.com/", error: undefined },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith("https://themes.shopify.com/themes/gravity/presets/gravity", expect.anything());
    expect(fetchSpy).toHaveBeenCalledWith("https://themes.shopify.com/themes/gravity/presets/decor", expect.anything());
  });

  it("reports one preset's failure without failing the others", async () => {
    global.fetch = vi.fn(async (url: string) =>
      url.includes("/presets/broken") ? { ok: false, status: 403 } : { ok: true, text: async () => presetPageHtml("https://ok-demo.myshopify.com/") }
    ) as unknown as typeof fetch;

    const results = await fetchPresetDemoStoreUrls("gravity", [
      { slug: "gravity", name: "Gravity" },
      { slug: "broken", name: "Broken" },
    ]);

    expect(results[0]).toEqual({ slug: "gravity", name: "Gravity", url: "https://ok-demo.myshopify.com/", error: undefined });
    expect(results[1].url).toBeNull();
    expect(results[1].error).toContain("403");
  });

  it("returns a null url with an error when the page has no demo-store element", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html><body>no demo here</body></html>" }) as unknown as typeof fetch;
    const results = await fetchPresetDemoStoreUrls("gravity", [{ slug: "gravity", name: "Gravity" }]);
    expect(results[0].url).toBeNull();
    expect(results[0].error).toBeTruthy();
  });
});
