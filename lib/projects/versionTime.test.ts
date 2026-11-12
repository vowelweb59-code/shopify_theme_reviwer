import { describe, expect, it } from "vitest";
import { versionTimeRows, type TimeEntryDay } from "./versionTime";

const e = (date: string, hours: number, memberId = "a", name = "Asha"): TimeEntryDay => ({ date, hours, memberId, name });
const versions = [
  { version: "1.1.3", releasedOn: "2026-10-13" },
  { version: "1.1.2", releasedOn: "2026-07-27" },
  { version: "1.1.1", releasedOn: null },
  { version: "1.0.0", releasedOn: "2026-05-13" },
];

describe("versionTimeRows", () => {
  it("windows work between dated releases, newest first, with a next-release row", () => {
    const entries = [e("2026-07-20", 8.5), e("2026-07-27", 8.5), e("2026-07-28", 4), e("2026-10-01", 8.5, "b", "Bo"), e("2026-10-01", 4, "a"), e("2026-10-20", 8.5)];
    const { rows, undated } = versionTimeRows(versions, entries, "2026-11-12");
    expect(rows.map((r) => r.version)).toEqual(["Next release", "1.1.3", "1.1.2", "1.0.0"]);
    expect(undated).toEqual(["1.1.1"]);

    const v112 = rows.find((r) => r.version === "1.1.2")!;
    expect(v112).toMatchObject({ since: "2026-05-13", calendarDays: 75, daysWorked: 2, hours: 17, effortDays: 2 }); // 20 and 27 July; the release day itself counts

    const v113 = rows.find((r) => r.version === "1.1.3")!;
    expect(v113).toMatchObject({ since: "2026-07-27", calendarDays: 78, daysWorked: 2, hours: 16.5 }); // 28 July and 1 Oct (two people on 1 Oct = one day)
    expect(v113.people).toEqual([
      { name: "Bo", hours: 8.5, days: 1 },
      { name: "Asha", hours: 8, days: 2 },
    ]);

    expect(rows[0]).toMatchObject({ version: "Next release", inProgress: true, since: "2026-10-13", calendarDays: 30, daysWorked: 1, hours: 8.5 });
  });
  it("gives the first release everything up to its day and no calendar span", () => {
    const { rows } = versionTimeRows(versions, [e("2026-04-01", 8.5)], "2026-11-12");
    expect(rows.find((r) => r.version === "1.0.0")).toMatchObject({ since: null, calendarDays: null, daysWorked: 1 });
  });
  it("shows zero days for a window with no entries and nothing for a theme with no dated release", () => {
    const { rows } = versionTimeRows(versions, [], "2026-11-12");
    expect(rows.every((r) => r.daysWorked === 0 && r.hours === 0)).toBe(true);
    expect(versionTimeRows([{ version: "1.0.0", releasedOn: null }], [e("2026-04-01", 1)], "2026-11-12")).toEqual({ rows: [], undated: ["1.0.0"] });
  });
});
