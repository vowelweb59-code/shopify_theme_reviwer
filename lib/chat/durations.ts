// Suggested design / development days for a theme, from the stored reports.
// Hours become days at 8.5 h/day (a typical 8 h 30 min report is one day).
// Whose hours count as design or development comes from their designation:
// UI/UX designers -> design, Shopify developers -> development; managers and
// anyone else are left out of the durations.
export const HOURS_PER_DAY = 8.5;

export type DurationReport = { minutes: number; designation: string | null };
export type Suggestion = { designDays: number | null; developmentDays: number | null; reportCount: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function suggestDurations(reports: DurationReport[]): Suggestion {
  let design = 0;
  let development = 0;
  for (const r of reports) {
    if (/designer|ui\/ux/i.test(r.designation ?? "")) design += r.minutes;
    else if (/developer/i.test(r.designation ?? "")) development += r.minutes;
  }
  return {
    designDays: design > 0 ? round2(design / 60 / HOURS_PER_DAY) : null,
    developmentDays: development > 0 ? round2(development / 60 / HOURS_PER_DAY) : null,
    reportCount: reports.length,
  };
}
