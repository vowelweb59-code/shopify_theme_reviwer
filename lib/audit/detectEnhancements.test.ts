import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { detectEnhancementPoints } from "./detectEnhancements";
import { ENHANCEMENT_DETECTORS } from "./enhancementDetectors";

describe("detectEnhancementPoints", () => {
  it("detects a content-pattern match and reports the matching file + line", () => {
    const theme = buildTestTheme({
      "sections/cart-drawer.liquid": "line one\n<cart-drawer>\n  {{ cart.item_count }}\n</cart-drawer>\n",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-CART-001"]);
      expect(result.detected).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].filePath).toBe("sections/cart-drawer.liquid");
      expect(result.matches[0].lineNumber).toBe(2);
    } finally {
      theme.cleanup();
    }
  });

  it("reports not detected, with no matches, when nothing in the theme matches", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": "<h1>{{ section.settings.heading }}</h1>",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-CART-001"]);
      expect(result.detected).toBe(false);
      expect(result.matches).toEqual([]);
    } finally {
      theme.cleanup();
    }
  });

  it("detects via pathPatterns even when the file content doesn't match a content pattern", () => {
    const theme = buildTestTheme({
      "sections/mega-menu.liquid": "<nav>{{ linklists.main-menu.links }}</nav>",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-DISCOVERY-002"]);
      expect(result.detected).toBe(true);
      expect(result.matches[0].filePath).toBe("sections/mega-menu.liquid");
    } finally {
      theme.cleanup();
    }
  });

  it("restricts detection to the requested pointIds", () => {
    const theme = buildTestTheme({
      "sections/cart-drawer.liquid": "<cart-drawer></cart-drawer>",
    });
    try {
      const results = detectEnhancementPoints(theme.parsed.files, ["TREND-MEDIA-001"]);
      expect(results).toHaveLength(1);
      expect(results[0].pointId).toBe("TREND-MEDIA-001");
      expect(results[0].detected).toBe(false);
    } finally {
      theme.cleanup();
    }
  });

  it("never inspects non-parseable asset files (images/fonts), even when the filename matches a pathPattern", () => {
    // .png has no structural content to extract, so the parser classifies it
    // as fileType "asset" (lib/theme-parser/walkFiles.ts) — unlike .js/.css/
    // .json under assets/, which are still parsed and should stay in scope.
    const theme = buildTestTheme({
      "assets/cart-drawer-icon.png": "not a real png, just text for the fixture",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-CART-001"]);
      expect(result.detected).toBe(false);
    } finally {
      theme.cleanup();
    }
  });

  it("still inspects parseable files that happen to live under assets/", () => {
    const theme = buildTestTheme({
      "assets/cart-drawer.js": "class CartDrawer extends HTMLElement {}",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-CART-001"]);
      expect(result.detected).toBe(true);
    } finally {
      theme.cleanup();
    }
  });

  it("caps evidence at 3 matches even when many files match", () => {
    const theme = buildTestTheme({
      "sections/cart-drawer-a.liquid": "<cart-drawer></cart-drawer>",
      "sections/cart-drawer-b.liquid": "<cart-drawer></cart-drawer>",
      "sections/cart-drawer-c.liquid": "<cart-drawer></cart-drawer>",
      "sections/cart-drawer-d.liquid": "<cart-drawer></cart-drawer>",
    });
    try {
      const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-CART-001"]);
      expect(result.detected).toBe(true);
      expect(result.matches.length).toBeLessThanOrEqual(3);
    } finally {
      theme.cleanup();
    }
  });

  describe("TREND-I18N-001 (predicate-based: needs more than just the default locale)", () => {
    it("is not detected with only locales/en.default.json", () => {
      const theme = buildTestTheme({
        "locales/en.default.json": "{}",
      });
      try {
        const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-I18N-001"]);
        expect(result.detected).toBe(false);
      } finally {
        theme.cleanup();
      }
    });

    it("is detected once a second locale file exists", () => {
      const theme = buildTestTheme({
        "locales/en.default.json": "{}",
        "locales/fr.json": "{}",
      });
      try {
        const [result] = detectEnhancementPoints(theme.parsed.files, ["TREND-I18N-001"]);
        expect(result.detected).toBe(true);
        expect(result.matches[0].filePath).toBe("locales/fr.json");
      } finally {
        theme.cleanup();
      }
    });
  });

  it("has a detector for every pointId exactly once, matching every enhancement-point data file", () => {
    // Two data files feed the EnhancementPoint collection now (theme-store
    // trends and, once seeded, native capabilities) — union both so this
    // test keeps working regardless of which have been generated yet.
    const trendIds: string[] = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "theme-trend-points.json"), "utf8")
    ).points.map((p: { pointId: string }) => p.pointId);

    const nativeCapabilitiesPath = path.join(process.cwd(), "data", "native-capabilities.json");
    const nativeIds: string[] = fs.existsSync(nativeCapabilitiesPath)
      ? JSON.parse(fs.readFileSync(nativeCapabilitiesPath, "utf8")).map((c: { pointId: string }) => c.pointId)
      : [];

    // Union, not concatenation: a native-capability point can ALSO have its
    // release-note adoption measured (scripts/seed-native-capabilities.ts),
    // which means its pointId legitimately appears in both data files.
    const seedIds = [...new Set([...trendIds, ...nativeIds])];
    const detectorIds = ENHANCEMENT_DETECTORS.map((d) => d.pointId);
    expect(new Set(detectorIds).size).toBe(detectorIds.length); // no duplicates
    expect(detectorIds.sort()).toEqual(seedIds.slice().sort());
  });
});
