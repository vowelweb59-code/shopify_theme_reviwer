import { HOURS_PER_DAY } from "@/lib/chat/durations";
import { UNDATED, type HoursInput } from "./cost";

type FixedDayProject = {
  _id: unknown;
  type?: string | null;
  designDays?: number | null;
  developmentDays?: number | null;
  designDaysBy?: unknown;
  developmentDaysBy?: unknown;
  designDaysSplit?: { memberId: unknown; share: number }[];
  developmentDaysSplit?: { memberId: unknown; share: number }[];
};

/**
 * The days entered by hand on a Theme Design & Development project (older themes; owner's manual sheet) priced as build hours of
 * the one person who worked them, when that person is recorded (`designDaysBy` / `developmentDaysBy`, or a shared out `...DaysSplit` of shares when several did; By is set only where the sheet names
 * a single designer / developer: owner, 2026-11-14, "the 32 days in design were all worked by Junaid"). Days with no single person
 * stay unpriced. They have no date, so they fall in the "undated" month. `keyOf` gives the key the costs are grouped by (a project
 * id, or its theme id).
 */
export function fixedDayInputs<P extends FixedDayProject>(projects: P[], keyOf: (project: P) => string): HoursInput[] {
  const out: HoursInput[] = [];
  for (const p of projects) {
    if ((p.type ?? "theme_development") !== "theme_development") continue;
    for (const [days, by, split] of [[p.designDays, p.designDaysBy, p.designDaysSplit], [p.developmentDays, p.developmentDaysBy, p.developmentDaysSplit]] as const) {
      if (!days || days <= 0) continue;
      // Several people: each one's share of the days; else the one person recorded.
      const shares = split && split.length > 0 ? split : by ? [{ memberId: by, share: 1 }] : [];
      for (const s of shares) out.push({ themeId: keyOf(p), memberId: String(s.memberId), line: "build", hours: days * s.share * HOURS_PER_DAY, month: UNDATED });
    }
  }
  return out;
}
