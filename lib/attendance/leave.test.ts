import { describe, expect, it } from "vitest";
import { normalizeName, parseDates, parseLeaveMessage } from "./leave";

const posted = new Date("2026-11-10T05:00:00Z");
const real = "@Huzefa kapadia Kunal Mendhe has applied for a leave  on  16th Nov 2026.(Diwali Festival - Bhaiduj)";
const mention = [{ start: 0, length: 15, displayName: "Huzefa kapadia" }];

describe("parseLeaveMessage", () => {
  it("reads the real announcement: lead from the mention, person after it, date and reason", () => {
    expect(parseLeaveMessage(real, mention, posted)).toEqual({
      kind: "leave",
      person: "Kunal Mendhe",
      lead: "Huzefa kapadia",
      dates: ["2026-11-16"],
      half: false,
      reason: "Diwali Festival - Bhaiduj",
    });
  });

  it("splits the names without mention data by the known names, else the last two words", () => {
    const a = parseLeaveMessage(real, [], posted, ["Kunal Mendhe", "Asha Rao"]);
    expect(a).toMatchObject({ kind: "leave", person: "Kunal Mendhe", lead: "Huzefa kapadia" });
    const b = parseLeaveMessage(real, [], posted);
    expect(b).toMatchObject({ kind: "leave", person: "Kunal Mendhe", lead: "Huzefa kapadia" });
    const c = parseLeaveMessage("@Huzefa kapadia Mary Ann Smith has applied for a leave on 3rd Dec 2026.", [], posted, ["Mary Ann Smith"]);
    expect(c).toMatchObject({ kind: "leave", person: "Mary Ann Smith", lead: "Huzefa kapadia" });
  });

  it("reads a range, a list and a half day", () => {
    expect(parseLeaveMessage("@Lead Sam Lee has applied for a leave from 16th Nov 2026 to 18th Nov 2026.(Trip)", [], posted, ["Sam Lee"])).toMatchObject({ dates: ["2026-11-16", "2026-11-17", "2026-11-18"], reason: "Trip" });
    expect(parseLeaveMessage("@Lead Sam Lee has applied for a leave on 16th & 18th Nov 2026.", [], posted, ["Sam Lee"])).toMatchObject({ dates: ["2026-11-16", "2026-11-18"] });
    expect(parseLeaveMessage("@Lead Sam Lee has applied for a half day leave on 20th Nov 2026.", [], posted, ["Sam Lee"])).toMatchObject({ dates: ["2026-11-20"], half: true });
  });

  it("flags what it cannot read instead of dropping it", () => {
    expect(parseLeaveMessage("@Lead Sam Lee has applied for a leave tomorrow.", [], posted, ["Sam Lee"])).toMatchObject({ kind: "unparsed" });
    expect(parseLeaveMessage("Good morning team", [], posted)).toEqual({ kind: "other" });
  });

  it("reads a cancellation", () => {
    expect(parseLeaveMessage("@Lead Sam Lee has cancelled the leave on 16th Nov 2026.", [], posted, ["Sam Lee"])).toMatchObject({ kind: "cancel", person: "Sam Lee", dates: ["2026-11-16"] });
  });
});

describe("parseDates", () => {
  it("fills a missing year from the post and rolls into the next year when the date has long passed", () => {
    expect(parseDates("on 20th Nov", posted)).toEqual(["2026-11-20"]);
    expect(parseDates("on 2nd Jan", new Date("2026-12-28T05:00:00Z"))).toEqual(["2027-01-02"]);
  });
  it("reads numeric dates day first, and ignores numbers that are not dates", () => {
    expect(parseDates("on 16/11/2026", posted)).toEqual(["2026-11-16"]);
    expect(parseDates("for 2 days from 16th Nov 2026", posted)).toEqual(["2026-11-16"]);
  });
  it("rejects impossible dates", () => {
    expect(parseDates("on 31st Nov 2026", posted)).toEqual([]);
  });
});

describe("normalizeName", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeName("  Kunal   MENDHE. ")).toBe("kunal mendhe");
  });
});
