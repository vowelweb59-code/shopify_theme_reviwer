import { describe, expect, it } from "vitest";
import { summarizeDays } from "./daysWorked";
import { suggestDurations } from "./durations";
import { parseReport, splitReports, splitThemes } from "./parseReport";
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

  it("reads the older Timer Report layout, with its own date and timer styles", () => {
    const old = (timer: string) => `============\nTimer Report (02-07-2026)\nTheme Name: Soft theme\nMemo: Worked 'Soft' theme testing.\nOFF-Timer: ${timer}\n------------\nStore URL: x`;
    expect(parseReport(old("1:10:hr"))).toMatchObject({ ok: true, value: { date: "2026-07-02", themeParts: ["Soft theme"], minutes: 70 } });
    expect(parseReport(old("45:min"))).toMatchObject({ ok: true, value: { minutes: 45 } });
    expect(parseReport(old("04 hr"))).toMatchObject({ ok: true, value: { minutes: 240 } });
    expect(parseReport(old("4:00:hr"))).toMatchObject({ ok: true, value: { minutes: 240 } });
    expect(parseReport(old("40"))).toMatchObject({ ok: false });
    expect(parseReport("Date: 22-10-2026\nTheme Name: A\nTimer: 08.30 hrs")).toMatchObject({ ok: true, value: { minutes: 510 } });
  });

  it("splits several older-layout reports in one message", () => {
    expect(splitReports("=====\nTimer Report (01-07-2026)\nTheme Name: A\nTimer: 1:00:hr\n=====\nTimer Report (02-07-2026)\nTheme Name: B\nTimer: 2:00:hr")).toHaveLength(2);
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
    expect(resolveMember("Aaqib Iqbal", [{ id: "3", name: "Aaquib Iqbal", aliases: ["Aaqib Iqbal"] }])).toBe("3");
    expect(resolveMember("Aaqib Iqbal", [{ id: "3", name: "Aaquib Iqbal" }])).toBeNull();
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

describe("summarizeDays", () => {
  it("adds up days per member by kind at 8.5 h/day and leaves Product Managers out", () => {
    const rows = summarizeDays([
      { memberId: "a", name: "Ann", designation: "UI/UX Designer", minutes: 510, kind: "theme" },
      { memberId: "a", name: "Ann", designation: "UI/UX Designer", minutes: 255, kind: "preset" },
      { memberId: "b", name: "Bob", designation: "Sr Shopify Developer", minutes: 1020, kind: "theme" },
      { memberId: "b", name: "Bob", designation: "Sr Shopify Developer", minutes: 510, kind: "update" },
      { memberId: "m", name: "Max", designation: "Product Manager", minutes: 5000, kind: "theme" },
    ]);
    expect(rows).toEqual([
      { memberId: "b", name: "Bob", designation: "Sr Shopify Developer", theme: 2, preset: 0, update: 1, total: 3, spaceHours: 25.5, manualHours: 0, totalHours: 25.5 },
      { memberId: "a", name: "Ann", designation: "UI/UX Designer", theme: 1, preset: 0.5, update: 0, total: 1.5, spaceHours: 12.75, manualHours: 0, totalHours: 12.75 },
    ]);
  });

  it("adds hours entered by hand as update work and keeps space and manual hours apart", () => {
    const rows = summarizeDays([
      { memberId: "a", name: "Ann", designation: "UI/UX Designer", minutes: 510, kind: "theme" },
      { memberId: "a", name: "Ann", designation: "UI/UX Designer", minutes: 255, kind: "update", manual: true },
      { memberId: "b", name: "Bob", designation: "Shopify Developer", minutes: 120, kind: "update", manual: true },
      { memberId: "m", name: "Max", designation: "Product Manager", minutes: 600, kind: "update", manual: true },
    ]);
    expect(rows[0]).toMatchObject({ memberId: "a", theme: 1, update: 0.5, total: 1.5, spaceHours: 8.5, manualHours: 4.25, totalHours: 12.75 });
    expect(rows[1]).toMatchObject({ memberId: "b", spaceHours: 0, manualHours: 2, totalHours: 2 });
    expect(rows).toHaveLength(2);
  });
});

describe("parseReport: other layouts", () => {
  const ok = (text: string, postedOn?: string) => {
    const r = parseReport(text, postedOn);
    return r.ok ? { date: r.value.date, theme: r.value.themeParts[0], minutes: r.value.minutes } : r;
  };
  it("reads 'Theme Report' headers and a Time line", () => {
    expect(ok("========\nTheme Report (24/09/2026)\nTheme Name: Breeze | Fresco Solutions\nTask Assign: X\nTime: 5.00 Hours\nMemo: Worked")).toEqual({ date: "2026-09-24", theme: "Breeze", minutes: 300 });
    expect(ok("Theme Report:- 25/09/2026\nTheme Name:- Breeze | Fresco Solutions\nMemo:- x\nTimer:- 8:30 hrs")).toEqual({ date: "2026-09-25", theme: "Breeze", minutes: 510 });
  });
  it("reads month names and spaces in the date", () => {
    expect((ok("Date:- 26 sept 2026\nTheme Name:- Aspire\nMemo:- x\nTimer:- 2:00 hrs") as { date: string }).date).toBe("2026-09-26");
    expect((ok("Date :- ( 22- OCT - 2026 )\nTheme Name:- Aspire | Wellness Preset.\nMemo:- x\nTimer:- 8.00 hrs.") as { date: string }).date).toBe("2026-10-22");
    expect((ok("Date:- (22 -10-2026)\nTheme Name: Noble Theme | Theme Update\nTimer:- 04:00 hrs") as { date: string }).date).toBe("2026-10-22");
  });
  it("uses the day the message was posted when the report has no date", () => {
    expect(ok("Theme Name:- Flaunt | Clothing\nMemo:- 3 images\nTimer:- 1:00 hrs", "2026-10-07")).toEqual({ date: "2026-10-07", theme: "Flaunt", minutes: 60 });
    expect(ok("Theme Name:- Flaunt\nTimer:- 1:00 hrs")).toEqual({ ok: false, error: "No date found." });
  });
  it("splits a message with several themes that each have a timer", () => {
    const parts = splitThemes("Date:- (12-10-2026)\nTheme Name: Versatile (Zeal Preset)\nMemo: a\nTime: 3.00 Hour\nTheme Name: Breeze\nMemo: b\nTime: 2.00 Hour");
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => ok(p))).toEqual([
      { date: "2026-10-12", theme: "Versatile (Zeal Preset)", minutes: 180 },
      { date: "2026-10-12", theme: "Breeze", minutes: 120 },
    ]);
  });
});

describe("splitReports keeps a message whole", () => {
  it("only splitThemes divides it per theme", () => {
    const text = "Date:- (12-10-2026)\nTheme Name: A\nMemo: a\nTime: 3.00 Hour\nTheme Name: B\nMemo: b\nTime: 2.00 Hour";
    expect(splitReports(text)).toHaveLength(1);
  });
});
