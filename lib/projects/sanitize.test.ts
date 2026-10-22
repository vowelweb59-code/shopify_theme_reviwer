import { describe, expect, it } from "vitest";
import { datesInOrder, parseDateOnly, parseProjectFields, parseProjectMembers, parseTeamMemberInput } from "./sanitize";

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
  });

  it("rejects an unknown status", () => {
    expect(parseProjectFields({ name: "P", status: "done" }, false).ok).toBe(false);
  });
});

describe("datesInOrder", () => {
  it("allows a missing date, equal dates, and due after start", () => {
    const a = new Date("2026-01-01");
    const b = new Date("2026-01-02");
    expect(datesInOrder(null, b)).toBe(true);
    expect(datesInOrder(a, a)).toBe(true);
    expect(datesInOrder(a, b)).toBe(true);
    expect(datesInOrder(b, a)).toBe(false);
  });
});
