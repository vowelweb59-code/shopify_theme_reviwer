import { describe, expect, it } from "vitest";
import { parseDateOnly, parseDays, parseProjectFields, parseProjectMembers, parseProjectType, parseTeamMemberInput, parseTimeEntryInput } from "./sanitize";

const ID_A = "507f1f77bcf86cd799439011";
const ID_B = "507f1f77bcf86cd799439012";

describe("parseTeamMemberInput", () => {
  it("trims, lowercases the email, and turns a blank email into null", () => {
    expect(parseTeamMemberInput({ name: "  Asha ", designation: " QA Engineer ", email: "" })).toEqual({
      ok: true,
      value: { name: "Asha", designation: "QA Engineer", email: null },
    });
    const withEmail = parseTeamMemberInput({ name: "Ravi", designation: "Lead", email: " Ravi@Example.COM " });
    expect(withEmail).toEqual({ ok: true, value: { name: "Ravi", designation: "Lead", email: "ravi@example.com" } });
  });

  it("requires a name and a designation, and rejects a malformed email", () => {
    expect(parseTeamMemberInput({ designation: "QA" }).ok).toBe(false);
    expect(parseTeamMemberInput({ name: "Asha", designation: " " }).ok).toBe(false);
    expect(parseTeamMemberInput({ name: "Asha", designation: "QA", email: "nope" }).ok).toBe(false);
  });
});

describe("parseDateOnly", () => {
  it("accepts real YYYY-MM-DD dates and maps empty to null", () => {
    expect(parseDateOnly("2026-10-22", "d")).toEqual({ ok: true, value: new Date("2026-10-22T00:00:00.000Z") });
    expect(parseDateOnly("", "d")).toEqual({ ok: true, value: null });
  });

  it("rejects other formats and impossible dates", () => {
    expect(parseDateOnly("22/10/2026", "d").ok).toBe(false);
    expect(parseDateOnly("2026-02-31", "d").ok).toBe(false);
  });
});

describe("parseProjectMembers", () => {
  it("drops invalid ids and duplicates, and nulls an empty role", () => {
    const result = parseProjectMembers([
      { memberId: ID_A, role: " Lead " },
      { memberId: ID_A, role: "dup" },
      { memberId: "not-an-id" },
      { memberId: ID_B, role: "" },
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        { memberId: ID_A, role: "Lead" },
        { memberId: ID_B, role: null },
      ],
    });
  });

  it("rejects a non-array", () => {
    expect(parseProjectMembers("x").ok).toBe(false);
  });
});

describe("parseProjectFields", () => {
  it("requires a name on create but not on a partial update", () => {
    expect(parseProjectFields({}, false).ok).toBe(false);
    expect(parseProjectFields({ status: "active" }, true)).toEqual({ ok: true, value: { status: "active" } });
    expect(parseProjectFields({ designDays: "10", developmentDays: "" }, true)).toEqual({ ok: true, value: { designDays: 10, developmentDays: null } });
  });

  it("rejects an unknown status", () => {
    expect(parseProjectFields({ name: "P", status: "done" }, false).ok).toBe(false);
  });
});

describe("parseDays", () => {
  it("treats blank as unknown and keeps 2 decimals", () => {
    expect(parseDays("", "d")).toEqual({ ok: true, value: null });
    expect(parseDays(null, "d")).toEqual({ ok: true, value: null });
    expect(parseDays("12.345", "d")).toEqual({ ok: true, value: 12.35 });
    expect(parseDays(0, "d")).toEqual({ ok: true, value: 0 });
  });

  it("rejects negative, huge and non-numeric values", () => {
    for (const raw of [-1, 99999, "abc"]) expect(parseDays(raw, "d").ok).toBe(false);
  });
});

describe("parseProjectType", () => {
  it("defaults a missing type to theme_development and rejects unknown ones", () => {
    expect(parseProjectType(undefined)).toEqual({ ok: true, value: "theme_development" });
    expect(parseProjectType("theme_update")).toEqual({ ok: true, value: "theme_update" });
    expect(parseProjectType("preset_development")).toEqual({ ok: true, value: "preset_development" });
    expect(parseProjectType("bogus").ok).toBe(false);
  });
});

describe("parseTimeEntryInput", () => {
  const base = { memberId: ID_A, date: "2026-10-22", hours: 1.5, note: " fixed cart " };

  it("accepts a valid entry, rounds hours to 2 decimals and trims the note", () => {
    expect(parseTimeEntryInput({ ...base, hours: "2.256" })).toEqual({
      ok: true,
      value: { memberId: ID_A, date: new Date("2026-10-22T00:00:00.000Z"), hours: 2.26, note: "fixed cart" },
    });
  });

  it("rejects zero, negative, too many or non-numeric hours", () => {
    for (const hours of [0, -1, 25, "abc", null]) expect(parseTimeEntryInput({ ...base, hours }).ok).toBe(false);
  });

  it("requires a valid member and a date", () => {
    expect(parseTimeEntryInput({ ...base, memberId: "x" }).ok).toBe(false);
    expect(parseTimeEntryInput({ ...base, date: "" }).ok).toBe(false);
  });
});
