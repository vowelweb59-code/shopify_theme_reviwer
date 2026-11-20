import { describe, expect, it } from "vitest";
import { closingDate } from "./manual-date";
import { validateTransition } from "./transitions";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("closingDate", () => {
  const now = d("2026-11-20");
  it("is the last report day", () => expect(closingDate({ lastReport: d("2026-11-05"), now, latestHistoryAt: null })).toEqual(d("2026-11-05")));
  it("is today when nothing was ever reported", () => expect(closingDate({ lastReport: null, now, latestHistoryAt: null })).toEqual(now));
  it("never lies in the future", () => expect(closingDate({ lastReport: d("2029-10-19"), now, latestHistoryAt: null })).toEqual(now));
  it("never goes before the project's previous history entry", () => expect(closingDate({ lastReport: d("2026-11-05"), now, latestHistoryAt: d("2026-11-12") })).toEqual(d("2026-11-12")));
});

describe("On hold to Completed", () => {
  it("is allowed (owner 2026-11-20)", () => expect(validateTransition("ON_HOLD", "COMPLETED")).toEqual({ ok: true }));
});
