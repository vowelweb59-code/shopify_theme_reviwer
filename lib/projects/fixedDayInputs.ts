import { HOURS_PER_DAY } from "@/lib/chat/durations";
import { UNDATED, type HoursInput } from "./cost";

type FixedDayProject = {
  _id: unknown;
  type?: string | null;
  designDays?: number | null;
  developmentDays?: number | null;
  designDaysBy?: unknown;
  developmentDaysBy?: unknown;
};

/**
 * The days entered by hand on a Theme Design & Development project (older themes; owner's manual sheet) priced as build hours of
 * the one person who worked them, when that person is recorded (`designDaysBy` / `developmentDaysBy`, set only where the sheet names
 * a single designer / developer: owner, 2026-11-14, "the 32 days in design were all worked by Junaid"). Days with no single person
 * stay unpriced. They have no date, so they fall in the "undated" month. `keyOf` gives the key the costs are grouped by (a project
 * id, or its theme id).
 */
export function fixedDayInputs<P extends FixedDayProject>(projects: P[], keyOf: (project: P) => string): HoursInput[] {
  const out: HoursInput[] = [];
  for (const p of projects) {
    if ((p.type ?? "theme_development") !== "theme_development") continue;
    for (const [days, by] of [[p.designDays, p.designDaysBy], [p.developmentDays, p.developmentDaysBy]] as const) {
      if (!days || days <= 0 || !by) continue;
      out.push({ themeId: keyOf(p), memberId: String(by), line: "build", hours: days * HOURS_PER_DAY, month: UNDATED });
    }
  }
  return out;
}
