import { describe, expect, it } from "vitest";
import { classifyHistorical } from "./historicalClassification";
import type { ThemeRef } from "./resolve";

const themes: ThemeRef[] = [
  { id: "v", name: "Voltix", presets: [] },
  { id: "n", name: "Nexus", presets: [] },
  { id: "p", name: "Pretty", presets: [] },
  { id: "s", name: "Soft", presets: [] },
];

describe("classifyHistorical", () => {
  it("October and September: listed themes are new development, every other theme is an update", () => {
    expect(classifyHistorical({ themeParts: ["Voltix", "Clothing"], date: "2026-10-07" }, themes)).toMatchObject({ ok: true, kind: "theme" });
    expect(classifyHistorical({ themeParts: ["Voltix Theme Preset"], date: "2026-10-07" }, themes)).toMatchObject({ kind: "preset" });
    expect(classifyHistorical({ themeParts: ["Voltix", "Clothing"], date: "2026-10-07" }, themes, { updatesAndPresetsOnly: true })).toMatchObject({ kind: "preset" });
    expect(classifyHistorical({ themeParts: ["Nexus Theme - Nexus", "Beauty"], date: "2026-10-22" }, themes)).toMatchObject({ ok: true, themeId: "n", kind: "update" });
    expect(classifyHistorical({ themeParts: ["Nexus"], date: "2026-09-30" }, themes)).toMatchObject({ kind: "update" });
  });

  it("treats Pearl as Pretty", () => {
    expect(classifyHistorical({ themeParts: ["Pearl", "Huzefa sir", "Beauty"], date: "2026-10-09" }, themes)).toMatchObject({ ok: true, themeId: "p", kind: "theme" });
  });

  it("August: Soft is an update except its Twinkle preset; June and July: all of Soft is theme work", () => {
    expect(classifyHistorical({ themeParts: ["Soft", "Twinkle"], date: "2026-08-12" }, themes)).toMatchObject({ kind: "preset" });
    expect(classifyHistorical({ themeParts: ["Soft", "Wellness"], date: "2026-08-12" }, themes)).toMatchObject({ kind: "update" });
    expect(classifyHistorical({ themeParts: ["Soft"], date: "2026-07-03" }, themes)).toMatchObject({ kind: "theme" });
    expect(classifyHistorical({ themeParts: ["Nexus"], date: "2026-06-03" }, themes)).toMatchObject({ kind: "update" });
  });

  it("refuses a month with no list, and reports an unknown theme", () => {
    expect(classifyHistorical({ themeParts: ["Voltix"], date: "2026-12-01" }, themes)).toMatchObject({ ok: false });
    expect(classifyHistorical({ themeParts: ["Nope"], date: "2026-10-01" }, themes)).toMatchObject({ ok: false });
  });
});

describe("names that appeared in the existing reports", () => {
  const more: ThemeRef[] = [...themes, { id: "z", name: "Zeal", presets: [] }, { id: "l", name: "Legacy", presets: [] }, { id: "h", name: "Home Décor", presets: [] }];

  it("maps the free-form names to their themes", () => {
    expect(classifyHistorical({ themeParts: ["Transform theme to Beauty", "Fresco Solutions"], date: "2026-09-26" }, more)).toMatchObject({ ok: true, themeId: "z", kind: "update" });
    expect(classifyHistorical({ themeParts: ["Bag Shopify Theme", "Flex Theme"], date: "2026-09-28" }, more)).toMatchObject({ ok: true, themeId: "l", kind: "update" });
    // Home Décor is a new theme, so its work is new development.
    expect(classifyHistorical({ themeParts: ["Home Décor", "Shopify", "Huzefa Sir"], date: "2026-10-22" }, more)).toMatchObject({ ok: true, themeId: "h", kind: "theme" });
  });
});
