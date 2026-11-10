import { describe, expect, it } from "vitest";
import { installsAreEstimated } from "./engine/metrics";
import { mergeFrom } from "./sync/runSync";
import { attributeInstalls, installRows, installsByThemeRequest, matchesAlias, mergeInstallRows, pickThemeDimension, themeAliases, unattributedReportRows } from "./installAttribution";

describe("pickThemeDimension", () => {
  it("finds the custom event parameter that names the theme, preferring a name or title", () => {
    expect(
      pickThemeDimension([
        { apiName: "customEvent:store_url", uiName: "Store URL" },
        { apiName: "customEvent:theme_id", uiName: "Theme id" },
        { apiName: "customEvent:theme_name", uiName: "Theme name" },
      ])
    ).toBe("customEvent:theme_name");
  });
  it("falls back to any theme parameter, and to null when there is none", () => {
    expect(pickThemeDimension([{ apiName: "customEvent:installed_theme", uiName: "" }])).toBe("customEvent:installed_theme");
    expect(pickThemeDimension([{ apiName: "customEvent:store_url", uiName: "Store URL" }, { apiName: "theme", uiName: "Theme" }])).toBeNull();
  });
});

describe("matching an event's theme to a theme", () => {
  const rare = themeAliases(["Rare", "Touch", "Charisma", "Rare", "", null]);
  it("collects a theme's name and presets once, normalised", () => {
    expect(rare).toEqual(["rare", "touch", "charisma"]);
  });
  it("matches the theme, a preset, or the name inside a longer value; never half a word", () => {
    expect(matchesAlias("Rare", rare)).toBe(true);
    expect(matchesAlias("touch", rare)).toBe(true);
    expect(matchesAlias("Rare - Charisma", rare)).toBe(true);
    expect(matchesAlias("Rarefied", rare)).toBe(false);
    expect(matchesAlias("Soft", rare)).toBe(false);
    expect(matchesAlias("", rare)).toBe(false);
  });
});

describe("attributeInstalls", () => {
  const row = (date: string, event: string, theme: string, n: number) => ({ dimensions: [date, event, theme], metrics: [n] });
  const aliases = themeAliases(["Rare", "Touch"]);

  it("counts this theme's installs exactly, ignores other themes' and other events, and sets aside the unnamed ones", () => {
    const rows = [
      row("20261105", "shopify_theme_install", "(not set)", 4),
      row("20261108", "shopify_theme_install", "Rare", 2),
      row("20261108", "shopify_theme_install", "Touch", 1),
      row("20261108", "shopify_theme_install", "Soft", 5),
      row("20261109", "shopify_theme_install", "Soft", 1),
      row("20261109", "add_to_cart", "Rare", 40),
    ];
    const a = attributeInstalls(rows, aliases);
    expect([...a.exact]).toEqual([["2026-11-08", 3]]);
    expect([...a.unattributed]).toEqual([["2026-11-05", 4]]);
    // The parameter first appears on 8 Nov (any theme), which is when exact counting starts.
    expect(a.firstNamedDate).toBe("2026-11-08");
  });

  it("has nothing exact and no start date when no event names a theme", () => {
    const a = attributeInstalls([row("20261105", "shopify_theme_install", "(not set)", 4)], aliases);
    expect(a.exact.size).toBe(0);
    expect(a.firstNamedDate).toBeNull();
  });
});

describe("install rows", () => {
  it("makes one total row per positive day, and adds rows of the same day together", () => {
    const exact = installRows(new Map([["2026-11-08", 3], ["2026-11-09", 0]]));
    expect(exact.map((r) => r.date)).toEqual(["2026-11-08"]);
    const merged = mergeInstallRows(exact, installRows(new Map([["2026-11-08", 0.5], ["2026-11-05", 1.25]])));
    expect(merged.map((r) => [r.date, r.metrics.eventCount]).sort()).toEqual([["2026-11-05", 1.25], ["2026-11-08", 3.5]]);
  });
  it("hands the unnamed installs on as property-wide report rows", () => {
    expect(unattributedReportRows(new Map([["2026-11-05", 4]]))).toEqual([{ dimensions: ["20261105", "shopify_theme_install"], metrics: [4] }]);
  });
});

describe("installsByThemeRequest", () => {
  it("asks for the install event by the theme parameter, over the whole property", () => {
    const r = installsByThemeRequest({ start: "2026-11-01", end: "2026-11-09" }, "customEvent:theme_name");
    expect(r.dimensions).toEqual([{ name: "date" }, { name: "eventName" }, { name: "customEvent:theme_name" }]);
    expect(r.dimensionFilter).toEqual({ filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "shopify_theme_install" } } });
  });
});

describe("when installs are still estimated", () => {
  const period = (start: string, prev: string | null = null) => ({ current: { start, end: "2026-11-30" }, previous: prev ? { start: prev, end: start } : null });
  const base = { pagePathPrefix: "/themes/rare/", earlier: null, installsExactFrom: "2026-11-05" };

  it("never for a theme with a property of its own", () => {
    expect(installsAreEstimated({ ...base, pagePathPrefix: null, installsExactFrom: null, period: period("2026-01-01") })).toBe(false);
  });
  it("always while no install event has named a theme", () => {
    expect(installsAreEstimated({ ...base, installsExactFrom: null, period: period("2026-11-20") })).toBe(true);
  });
  it("only for ranges (or comparison ranges) reaching back before the parameter first appears", () => {
    expect(installsAreEstimated({ ...base, period: period("2026-11-05") })).toBe(false);
    expect(installsAreEstimated({ ...base, period: period("2026-11-01") })).toBe(true);
    expect(installsAreEstimated({ ...base, period: period("2026-11-20", "2026-11-01") })).toBe(true);
  });
});

describe("mergeFrom", () => {
  it("keeps the earlier of the stored start and the one just seen, for the same parameter", () => {
    const theme = { installsExactBy: "customEvent:theme_name", installsExactFrom: "2026-11-05" };
    expect(mergeFrom(theme, "customEvent:theme_name", "2026-11-08")).toBe("2026-11-05");
    expect(mergeFrom(theme, "customEvent:theme_name", "2026-11-02")).toBe("2026-11-02");
    expect(mergeFrom(theme, "customEvent:theme_name", null)).toBe("2026-11-05");
  });
  it("starts over when the parameter is a different one", () => {
    expect(mergeFrom({ installsExactBy: "customEvent:old", installsExactFrom: "2026-01-01" }, "customEvent:theme_name", "2026-11-08")).toBe("2026-11-08");
    expect(mergeFrom({ installsExactBy: null, installsExactFrom: null }, "customEvent:theme_name", null)).toBeNull();
  });
});
