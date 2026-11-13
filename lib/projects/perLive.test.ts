import { describe, expect, it } from "vitest";
import { perLivePayments, type LiveProject, type PerLivePerson } from "./perLive";

const lead: PerLivePerson = { id: "lead", perLiveTheme: 10000, perLivePreset: 5000 };
const other: PerLivePerson = { id: "other", perLiveTheme: 10000, perLivePreset: 5000 };

const theme: LiveProject = { id: "p1", themeId: "t1", kind: "theme", people: new Set(["lead", "dev"]), month: "2026-10" };
const preset: LiveProject = { id: "p2", themeId: "t1", kind: "preset", people: new Set(["lead", "other"]), month: null };

describe("perLivePayments", () => {
  it("pays each per-live person on a live project its theme or preset amount", () => {
    expect(perLivePayments([theme, preset], [lead, other])).toEqual([
      { projectId: "p1", themeId: "t1", memberId: "lead", line: "build", amount: 10000, month: "2026-10" },
      { projectId: "p2", themeId: "t1", memberId: "lead", line: "presets", amount: 5000, month: null },
      { projectId: "p2", themeId: "t1", memberId: "other", line: "presets", amount: 5000, month: null },
    ]);
  });

  it("pays nobody who is not on the project, and nothing without an amount", () => {
    expect(perLivePayments([theme], [other])).toEqual([]);
    expect(perLivePayments([preset], [{ id: "lead", perLiveTheme: 10000, perLivePreset: null }])).toEqual([]);
  });
});
