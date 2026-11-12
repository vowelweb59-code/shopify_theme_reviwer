import { describe, expect, it } from "vitest";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";
import { featureCells, portfolioSuggestions, suggestionsByTheme } from "./featureSuggestions";

const all = AVAILABLE_FEATURES.map((f) => f.label);

describe("live store evidence", () => {
  it("a feature seen on the live store counts as detected even when nothing else says so", () => {
    const f = AVAILABLE_FEATURES.find((x) => x.id === "slide-out-cart")!;
    expect(featureStatus(f, new Map(), undefined, new Set(["slide-out-cart"]))).toBe("detected");
    expect(featureStatus(f, new Map(), undefined, new Set())).toBe("not_checked");
  });
  it("not seen live never lowers a status the listing or code gave", () => {
    const f = AVAILABLE_FEATURES.find((x) => x.id === "slide-out-cart")!;
    expect(featureStatus(f, new Map([["TREND-CART-001", true]]), undefined, new Set())).toBe("detected");
    expect(featureStatus(f, new Map(), new Set([f.label.toLowerCase()]), new Set())).toBe("detected");
  });
  it("ignores live ids for features a live store cannot show", () => {
    const f = AVAILABLE_FEATURES.find((x) => x.id === "high-resolution-images")!;
    expect(featureStatus(f, new Map(), undefined, new Set(["high-resolution-images"]))).toBe("not_checked");
  });
  it("records where each source stands", () => {
    const cells = featureCells({ name: "A", themeStoreFeatures: ["Slide-out cart"], liveFeatures: [] });
    expect(cells.get("slide-out-cart")?.sources).toEqual({ code: null, live: false, store: true });
    expect(cells.get("pre-order")?.sources.live).toBe(false);
    expect(cells.get("high-resolution-images")?.sources.live).toBeNull();
  });
});

describe("portfolioSuggestions", () => {
  const full = { name: "Full", themeStoreFeatures: all };
  const half = { name: "Half", themeStoreFeatures: all.slice(0, 40) };
  const bare = { name: "Bare", themeStoreFeatures: [] as string[] };

  it("ranks features by how many themes lack them and leaves out what every theme has", () => {
    const out = portfolioSuggestions([full, half, bare], 100);
    // Everything in the first 40 is lacked only by "Bare"; the rest by "Half" and "Bare".
    expect(out[0].missing).toEqual(["Half", "Bare"]);
    expect(out.every((g) => g.missing.length > 0)).toBe(true);
    expect(portfolioSuggestions([full, full], 100)).toEqual([]);
  });
  it("caps the list", () => {
    expect(portfolioSuggestions([full, bare], 5)).toHaveLength(5);
  });
});

describe("suggestionsByTheme", () => {
  it("lists what each theme lacks, most-shipped features first, and the theme missing most first", () => {
    const themes = [
      { name: "Full", themeStoreFeatures: all },
      { name: "Some", themeStoreFeatures: all.slice(0, 50) },
      { name: "Bare", themeStoreFeatures: [] as string[] },
    ];
    const out = suggestionsByTheme(themes, 3);
    expect(out.map((o) => o.theme)).toEqual(["Bare", "Some", "Full"]);
    expect(out[0].total).toBe(AVAILABLE_FEATURES.length);
    expect(out[0].gaps).toHaveLength(3);
    expect(out[0].gaps[0].haveCount).toBeGreaterThanOrEqual(out[0].gaps[2].haveCount);
    expect(out[2].total).toBe(0);
  });
});
