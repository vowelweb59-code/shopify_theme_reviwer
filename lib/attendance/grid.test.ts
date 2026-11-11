import { describe, expect, it } from "vitest";
import { buildGrid, daysBetween, matchPersonKey, type Leave, type PersonInput } from "./grid";
import { normalizeName } from "./leave";

// Nov 2026: the 9th is a Monday, the 14th a Saturday, the 15th a Sunday.
const days = daysBetween("2026-11-09", "2026-11-17");
const today = "2026-11-17";
const person = (key: string, upwork: string[], theme: string[] = []): PersonInput => ({ key, name: key, reports: { upwork: new Set(upwork), theme: new Set(theme) } });
const statusOf = (rows: ReturnType<typeof buildGrid>["rows"], key: string, day: string) => rows.find((r) => r.key === key)!.cells.find((c) => c.day === day)!.status;

describe("buildGrid", () => {
  it("flags a working day with no report and no leave, and not the weekend", () => {
    // Reported Mon, Tue, Thu, Fri (not Wed 11th); nothing on Sat 14th / Sun 15th; Mon 16th reported.
    const { rows, flags } = buildGrid({ days, today, people: [person("a", ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-16"])], leaves: new Map() });
    expect(flags.map((f) => [f.day, f.kind])).toEqual([["2026-11-11", "missing"]]);
    expect(statusOf(rows, "a", "2026-11-14")).toBe("saturday");
    expect(statusOf(rows, "a", "2026-11-15")).toBe("sunday");
  });

  it("does not flag an announced leave, and flags a leave on a day hours were reported", () => {
    const leaves = new Map<string, Map<string, Leave>>([["a", new Map([["2026-11-11", { half: false, reason: "Diwali" }], ["2026-11-12", { half: false, reason: null }]])]]);
    const { rows, flags } = buildGrid({ days, today, people: [person("a", ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-16"])], leaves });
    expect(statusOf(rows, "a", "2026-11-11")).toBe("leave");
    expect(flags.map((f) => [f.day, f.kind])).toEqual([["2026-11-12", "leave-but-reported"]]);
  });

  it("still expects a report on a half-day leave", () => {
    const leaves = new Map<string, Map<string, Leave>>([["a", new Map([["2026-11-11", { half: true, reason: null }]])]]);
    const { flags } = buildGrid({ days, today, people: [person("a", ["2026-11-09", "2026-11-16"])], leaves });
    expect(flags.some((f) => f.day === "2026-11-11" && f.kind === "missing")).toBe(true);
  });

  it("counts a report in either place for someone who belongs to both, and names where each is expected", () => {
    const p = person("a", ["2026-11-09", "2026-11-10"], ["2026-11-11"]);
    const { flags, rows } = buildGrid({ days: daysBetween("2026-11-09", "2026-11-11"), today, people: [p], leaves: new Map() });
    expect(flags).toEqual([]);
    expect(rows[0].sources).toEqual(["upwork", "theme"]);
  });

  it("does not flag today or the future, days before someone's first report, or long after their last", () => {
    const { rows } = buildGrid({ days: daysBetween("2026-09-28", "2026-11-17"), today, people: [person("a", ["2026-10-05"])], leaves: new Map() });
    expect(statusOf(rows, "a", "2026-09-29")).toBe("inactive");
    expect(statusOf(rows, "a", "2026-11-16")).toBe("inactive"); // more than 30 days after the last report
    const late = buildGrid({ days, today, people: [person("b", ["2026-11-09", "2026-11-16"])], leaves: new Map() });
    expect(statusOf(late.rows, "b", "2026-11-17")).toBe("pending");
  });

  it("leaves out people who never reported", () => {
    expect(buildGrid({ days, today, people: [person("ghost", [])], leaves: new Map() }).rows).toEqual([]);
  });
});

describe("matchPersonKey", () => {
  const people = [
    { key: "kunal mendhe", names: ["Kunal Mendhe"] },
    { key: "asha rao", names: ["Asha Rao", "Asha R"] },
    { key: "sam lee", names: ["Sam Lee"] },
    { key: "sam lee jr", names: ["Sam Lee Jr"] },
  ];
  it("matches exactly, then by a unique contained name, and refuses an ambiguous one", () => {
    expect(matchPersonKey("kunal  MENDHE", people, normalizeName)).toBe("kunal mendhe");
    expect(normalizeName("José  Núñez")).toBe("jose nunez");
    expect(matchPersonKey("Asha Rao Patil", people, normalizeName)).toBe("asha rao");
    expect(matchPersonKey("Sam Lee", people, normalizeName)).toBe("sam lee");
    expect(matchPersonKey("Nobody Here", people, normalizeName)).toBeNull();
  });
});
