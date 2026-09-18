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
