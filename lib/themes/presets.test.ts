import { describe, expect, it } from "vitest";
import { MAX_PRESETS, sanitizePresets } from "./presets";

describe("sanitizePresets", () => {
  it("returns an empty array for non-array input", () => {
    expect(sanitizePresets(null)).toEqual([]);
    expect(sanitizePresets(undefined)).toEqual([]);
    expect(sanitizePresets("not an array")).toEqual([]);
  });

  it("keeps valid http(s) entries and fills in a default label", () => {
    expect(sanitizePresets([{ label: "", url: "https://a.myshopify.com" }])).toEqual([
      { label: "Preset 1", url: "https://a.myshopify.com" },
    ]);
  });

  it("drops entries without a valid http(s) url", () => {
    expect(
      sanitizePresets([
        { label: "Bad", url: "not-a-url" },
        { label: "Good", url: "https://good.myshopify.com" },
      ])
    ).toEqual([{ label: "Good", url: "https://good.myshopify.com" }]);
  });

  it(`caps the result at ${MAX_PRESETS} entries`, () => {
    const raw = Array.from({ length: 8 }, (_, i) => ({ label: `Preset ${i + 1}`, url: `https://p${i + 1}.myshopify.com` }));
    const result = sanitizePresets(raw);
    expect(result).toHaveLength(MAX_PRESETS);
    expect(result.map((p) => p.url)).toEqual([
      "https://p1.myshopify.com",
      "https://p2.myshopify.com",
      "https://p3.myshopify.com",
      "https://p4.myshopify.com",
      "https://p5.myshopify.com",
    ]);
  });

  it("caps after filtering out invalid entries, not before", () => {
    const raw = [
      { label: "Bad", url: "not-a-url" },
      ...Array.from({ length: 6 }, (_, i) => ({ label: `Preset ${i + 1}`, url: `https://p${i + 1}.myshopify.com` })),
    ];
    const result = sanitizePresets(raw);
    expect(result).toHaveLength(MAX_PRESETS);
    expect(result[0].url).toBe("https://p1.myshopify.com");
  });
});
