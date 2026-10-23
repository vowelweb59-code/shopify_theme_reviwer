import { describe, expect, it } from "vitest";
import { suggestDurations } from "./durations";
import { parseReport, splitReports } from "./parseReport";
import { isUpdateMemo, resolveMember, resolveTheme, type ThemeRef } from "./resolve";

describe("parseReport", () => {
  it("reads the two sample reports", () => {
    expect(parseReport("Date:- (22-10-2026)\n\nTheme Name: Kombat | Gaming Theme | Theme Studio\nMemo: Worked on the product page development\nTimer: 08.30 hrs")).toEqual({
      ok: true,
      value: { date: "2026-10-22", themeParts: ["Kombat", "Gaming Theme", "Theme Studio"], memo: "Worked on the product page development", minutes: 510 },
    });
    expect(parseReport("Date: 22-10-2026 \nTheme Name:-  Gravity | Decor | Home Decor\nMemo – Bug fixes and demo setup \nTimer:- 08:30 hrs")).toEqual({
      ok: true,
      value: { date: "2026-10-22", themeParts: ["Gravity", "Decor", "Home Decor"], memo: "Bug fixes and demo setup", minutes: 510 },
    });
  });

  it("reads the Noble update report", () => {
    expect(parseReport("Date:- (21-10-2026)\n\nTheme Name: Noble Theme\nMemo: Working on updating and Adding Features\nTimer:- 04:00 hrs")).toEqual({
      ok: true,
      value: { date: "2026-10-21", themeParts: ["Noble Theme"], memo: "Working on updating and Adding Features", minutes: 240 },
    });
  });

  it("reads whole hours and rejects bad input with a reason", () => {
    expect(parseReport("Date: 1-2-2026\nTheme Name: A\nTimer: 6 hrs")).toMatchObject({ ok: true, value: { date: "2026-02-01", minutes: 360 } });
    expect(parseReport("Theme Name: A\nTimer: 6 hrs")).toEqual({ ok: false, error: "No date found." });
    expect(parseReport("Date: 31-02-2026\nTheme Name: A\nTimer: 6 hrs")).toMatchObject({ ok: false });
    expect(parseReport("Date: 1-2-2026\nTimer: 6 hrs")).toEqual({ ok: false, error: "No theme name found." });
    expect(parseReport("Date: 1-2-2026\nTheme Name: A")).toEqual({ ok: false, error: "No timer found." });
    expect(parseReport("Date: 1-2-2026\nTheme Name: A\nTimer: 08.75 hrs")).toMatchObject({ ok: false });
  });
});

describe("splitReports", () => {
  it("splits pasted text at each Date line", () => {
    expect(splitReports("Date: 1-1-2026\nTheme Name: A\nTimer: 1 hrs\n\nDate: 2-1-2026\nTheme Name: B\nTimer: 2 hrs")).toHaveLength(2);
    expect(splitReports("   ")).toEqual([]);
  });
});

const themes: ThemeRef[] = [
  { id: "g", name: "Gravity", presets: ["Decor", "Gold"] },
  { id: "k", name: "Kombat", presets: [], building: true },
];

describe("resolveTheme / resolveMember", () => {
  it("calls it preset work only when the second part is one of the theme's presets, and flags any other second part", () => {
    expect(resolveTheme({ themeParts: ["Gravity", "decor", "Home Decor"] }, themes)).toMatchObject({ ok: true, kind: "preset", preset: "Decor" });
    // Kombat is still being built, so its category is not a preset; Gravity is Live, so an unknown second part is flagged.
    expect(resolveTheme({ themeParts: ["Kombat", "Gaming Theme", "Theme Studio"] }, themes)).toMatchObject({ ok: true, kind: "theme", preset: null });
    expect(resolveTheme({ themeParts: ["Kombat", "Gaming Theme"] }, themes, { updatesAndPresetsOnly: true })).toMatchObject({ ok: false });
    expect(resolveTheme({ themeParts: ["Gravity", "Kids"], memo: "Fixes" }, themes)).toMatchObject({ ok: false });
    expect(resolveTheme({ themeParts: ["Kombat"], memo: "Product page" }, themes)).toMatchObject({ ok: true, kind: "theme", preset: null });
    expect(resolveTheme({ themeParts: ["Nope"] }, themes)).toMatchObject({ ok: false });
  });

  it("treats a memo about updating as Theme Update work, and ignores a trailing 'Theme' in the name", () => {
    expect(isUpdateMemo("Working on updating and Adding Features")).toBe(true);
    expect(isUpdateMemo("Worked on the product page development")).toBe(false);
    expect(isUpdateMemo("Bug fixes")).toBe(false);
    const withNoble = [...themes, { id: "n", name: "Noble", presets: [] }];
    expect(resolveTheme({ themeParts: ["Noble Theme"], memo: "Working on updating and Adding Features" }, withNoble)).toMatchObject({ ok: true, themeId: "n", kind: "update" });
    expect(resolveTheme({ themeParts: ["Gravity", "Decor"], memo: "updated demo" }, withNoble)).toMatchObject({ kind: "preset" });
  });

  it("for someone who never works on new themes, a report is preset or update work, and an unknown second part is flagged", () => {
    const only = { updatesAndPresetsOnly: true };
    expect(resolveTheme({ themeParts: ["Kombat"], memo: "Fixed footer" }, themes, only)).toMatchObject({ ok: true, kind: "update" });
    expect(resolveTheme({ themeParts: ["Gravity", "Decor"], memo: "Fixed footer" }, themes, only)).toMatchObject({ ok: true, kind: "preset" });
    expect(resolveTheme({ themeParts: ["Gravity", "Pearl"], memo: "Fixed footer" }, themes, only)).toMatchObject({ ok: false });
    expect(resolveTheme({ themeParts: ["Gravity", "Pearl"], memo: "Updating footer" }, themes, only)).toMatchObject({ ok: true, kind: "update" });
    expect(resolveTheme({ themeParts: ["Kombat", "Gaming Theme"], memo: "Updating product page" }, themes)).toMatchObject({ ok: true, kind: "update" });
  });

  it("finds the theme in loosely written names, and treats the word Preset as preset work", () => {
    const known: ThemeRef[] = [
      { id: "a", name: "Aspire", presets: [] },
      { id: "v", name: "Voltix", presets: [] },
      { id: "n", name: "Nexus", presets: [] },
      { id: "z", name: "Zeal", presets: [] },
      { id: "s", name: "Soft", presets: [] },
    ];
    expect(resolveTheme({ themeParts: ["Aspire Preset", "Beauty"] }, known)).toMatchObject({ ok: true, themeId: "a", kind: "preset", preset: "Beauty" });
    expect(resolveTheme({ themeParts: ["Clothing Theme (Voltix Preset)"] }, known)).toMatchObject({ ok: true, themeId: "v", kind: "preset" });
    expect(resolveTheme({ themeParts: ["Women's Clothing Shopify Theme ( Nexus )"], memo: "Fixes" }, known)).toMatchObject({ ok: true, themeId: "n", kind: "theme" });
    expect(resolveTheme({ themeParts: ["Zeal Theme - Zeal"] }, known)).toMatchObject({ ok: true, themeId: "z" });
    expect(resolveTheme({ themeParts: ["Soft Theme"] }, known)).toMatchObject({ ok: true, themeId: "s" });
    expect(resolveTheme({ themeParts: ["Pearl", "Beauty"] }, known)).toMatchObject({ ok: false });
    expect(resolveTheme({ themeParts: ["Aspire and Voltix"] }, known)).toMatchObject({ ok: false });
  });

  it("splits a capital I used as a separator", () => {
    expect(parseReport("Date: 1-1-2026\nTheme Name : Voltix I Scarlet I Jewelry\nTimer: 1 hrs")).toMatchObject({ ok: true, value: { themeParts: ["Voltix", "Scarlet", "Jewelry"] } });
  });

  it("matches a poster to one team member by name", () => {
    const members = [
      { id: "1", name: "Pranay Nimje" },
      { id: "2", name: "Pranay Fanidhare" },
    ];
    expect(resolveMember("  pranay  nimje ", members)).toBe("1");
    expect(resolveMember("Pranay", members)).toBeNull();
  });
});

describe("suggestDurations", () => {
  it("turns designer hours into design days and developer hours into development days at 8.5 h/day", () => {
    expect(
      suggestDurations([
        { minutes: 510, designation: "UI/UX Designer" },
        { minutes: 510, designation: "Sr Shopify Developer" },
        { minutes: 1020, designation: "Shopify Developer" },
        { minutes: 600, designation: "Product Manager" },
      ])
    ).toEqual({ designDays: 1, developmentDays: 3, reportCount: 4 });
    expect(suggestDurations([])).toEqual({ designDays: null, developmentDays: null, reportCount: 0 });
  });
});
