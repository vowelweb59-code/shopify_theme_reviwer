import { describe, expect, it } from "vitest";
import { classifyStorefront, matchPresetName, sheetPresetName } from "./detectStorePreset";

const PRESETS = ["Adorn", "Ace", "Choice", "Closet", "Precious"];
const page = (theme: object, extra = "") => `<html><head><script>Shopify.theme = ${JSON.stringify(theme)};</script></head><body>${extra}</body></html>`;

describe("matchPresetName", () => {
  it("finds the preset in the live theme name, as real Adorn buyers name it", () => {
    expect(matchPresetName("Precious", PRESETS)).toBe("Precious");
    expect(matchPresetName("Ace - Dev Copy", PRESETS)).toBe("Ace");
    expect(matchPresetName("Updated copy of Closet", PRESETS)).toBe("Closet");
    expect(matchPresetName("Adorn", PRESETS)).toBe("Adorn");
    expect(matchPresetName("Adorn - Choice", PRESETS)).toBe("Choice");
  });

  it("needs a whole word, and gives up on renamed themes", () => {
    expect(matchPresetName("Acedemy Store", PRESETS)).toBeNull();
    expect(matchPresetName("A Pocket of Posies 2026", PRESETS)).toBeNull();
    expect(matchPresetName(null, PRESETS)).toBeNull();
  });
});

describe("sheetPresetName", () => {
  it("accepts real preset names and ignores the sheet's status words", () => {
    expect(sheetPresetName("precious", PRESETS)).toBe("Precious");
    for (const v of ["Store Unavailable", "Password Protection", "Dropped", "", "Taste"]) expect(sheetPresetName(v, PRESETS)).toBeNull();
  });
});

describe("classifyStorefront", () => {
  it("reads a live store still on the theme", () => {
    const r = classifyStorefront(page({ name: "Precious", schema_name: "Adorn" }), "https://elainesilverco.com/", "Adorn", PRESETS);
    expect(r).toMatchObject({ status: "live", presetFromName: "Precious", liveSchemaName: "Adorn", liveUrl: "https://elainesilverco.com/" });
  });

  it("still detects the preset behind a password page", () => {
    const r = classifyStorefront(page({ name: "Closet", schema_name: "Adorn" }), "https://x.myshopify.com/password", "Adorn", PRESETS);
    expect(r).toMatchObject({ status: "password", presetFromName: "Closet" });
  });

  it("marks a store that switched theme as dropped", () => {
    const r = classifyStorefront(page({ name: "Horizon", schema_name: "Horizon" }), "https://limitlessathletics.shop/", "Adorn", PRESETS);
    expect(r).toMatchObject({ status: "dropped", liveThemeName: "Horizon", presetFromName: null });
  });

  it("reports a page with no Shopify theme data", () => {
    expect(classifyStorefront("<html></html>", "https://example.com/", "Adorn", PRESETS).status).toBe("error");
  });
});
