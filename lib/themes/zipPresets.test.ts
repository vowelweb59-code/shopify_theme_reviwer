import { describe, expect, it } from "vitest";
import { presetNamesFromSettingsData, presetSlug } from "./zipPresets";

describe("presetNamesFromSettingsData", () => {
  it("reads the preset names after the leading comment block", () => {
    const raw = `/* generated */\n{"current":"Renovate","presets":{"Renovate":{},"Industrial":{"x":1}}}`;
    expect(presetNamesFromSettingsData(raw)).toEqual(["Renovate", "Industrial"]);
  });
  it("returns [] for no presets, bad JSON or an array", () => {
    expect(presetNamesFromSettingsData(`{"current":{}}`)).toEqual([]);
    expect(presetNamesFromSettingsData("not json")).toEqual([]);
    expect(presetNamesFromSettingsData(`{"presets":[1]}`)).toEqual([]);
  });
});

describe("presetSlug", () => {
  it("lower-cases and joins words with a dash", () => {
    expect(presetSlug("Green Scape")).toBe("green-scape");
    expect(presetSlug("  Vector! ")).toBe("vector");
  });
});
