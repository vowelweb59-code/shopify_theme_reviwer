import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveThemeStoreSlug, fetchThemeStoreFeatureLabels } from "./themeStoreFeatures";

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
