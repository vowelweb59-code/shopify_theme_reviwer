// Daily time reports posted in the "Theme Status Group" space, one per person
// per theme, e.g.
//
//   Date:- (22-10-2026)
//   Theme Name: Kombat | Gaming Theme | Theme Studio
//   Memo: Worked on the product page development
//   Timer: 08.30 hrs
//
// The author is whoever posted the message, so it is not in the text. Dates
// are day-month-year; "08.30 hrs" and "08:30 hrs" both mean 8 h 30 min.

export type ParsedReport = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** The "|"-separated parts of the Theme Name line; the first is the theme. */
  themeParts: string[];
  memo: string;
  minutes: number;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// "Date:- (22-10-2026)", the older "Timer Report (02-07-2026)", "Theme Report:- 25/09/2026"; the month may be a name ("26 sept 2026",
// "( 22- OCT - 2026 )") and spaces around the separators are fine.
const DATE_RE = /(?:date|(?:theme|timer)\s*report)\W{0,6}(\d{1,2})\s*[-/.]?\s*(\d{1,2}|[a-z]{3,9})\s*[-/.]?\s*(\d{4})/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const THEME_RE = /theme\s*name\s*[:\-–—]*\s*(.+)/i;
const MEMO_RE = /memo\s*[:\-–—]*\s*(.+)/i;
// "08.30 hrs", "8:30", "6 hrs", "1:10:hr" (1 h 10 min), "45:min" (45 minutes), "04 hr".
const TIMER_RE = /\btimer?\b\s*[:\-–—]*\s*(\d{1,3})(?:\s*[.:]\s*(\d{1,2}))?(?:\s*[.:]?\s*(hrs?|hours?|mins?|minutes?))?/i;

/**
 * `postedOn` (YYYY-MM-DD, the day the message was posted) stands in for a report that has no date of its own.
 */
export function parseReport(text: string, postedOn?: string): Result<ParsedReport> {
  const date = DATE_RE.exec(text);
  let iso = postedOn ?? "";
  if (date) {
    const named = MONTHS.indexOf(date[2].slice(0, 3).toLowerCase()) + 1;
    const month = /^\d+$/.test(date[2]) ? Number(date[2]) : named;
    const [day, year] = [Number(date[1]), Number(date[3])];
    iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const check = new Date(`${iso}T00:00:00.000Z`);
    if (month === 0 || Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return { ok: false, error: `"${date[1]}-${date[2]}-${date[3]}" is not a real date.` };
  } else if (!iso) return { ok: false, error: "No date found." };

  const theme = THEME_RE.exec(text);
  // "|" separates the parts; some people type a capital "I" between spaces instead ("Voltix I Clothing").
  const themeParts = (theme?.[1] ?? "").split(/\s*\|\s*|\s+I\s+/).map((p) => p.trim()).filter(Boolean);
  if (themeParts.length === 0) return { ok: false, error: "No theme name found." };

  const timer = TIMER_RE.exec(text);
  if (!timer) return { ok: false, error: "No timer found." };
  // A minutes unit ("45:min") means the number is minutes; otherwise it is hours, with optional minutes after it.
  const inMinutes = /^min/i.test(timer[3] ?? "");
  const mins = timer[2] === undefined || inMinutes ? 0 : Number(timer[2].length === 1 ? `${timer[2]}0` : timer[2]);
  if (mins >= 60) return { ok: false, error: `Timer "${timer[0].trim()}" has more than 59 minutes.` };
  const minutes = inMinutes ? Number(timer[1]) : Number(timer[1]) * 60 + mins;
  if (minutes <= 0 || minutes > 24 * 60) return { ok: false, error: `Timer "${timer[0].trim()}" is not a plausible day.` };

  return { ok: true, value: { date: iso, themeParts, memo: (MEMO_RE.exec(text)?.[1] ?? "").trim(), minutes } };
}

/**
 * Splits pasted text holding several reports: each one starts at a "Date" line, or "Timer Report" / "Theme Report" in the older layouts.
 */
export function splitReports(text: string): string[] {
  // A report starts at a "Date" line or, in the older layouts, a "Timer Report" / "Theme Report" line (often wrapped in ==== or ---- rules).
  const starts = [...text.matchAll(/^[ 	=\-_*#]*(?:date|(?:timer|theme)\s*report)/gim)].map((m) => m.index ?? 0);
  if (starts.length === 0) return text.trim() ? [text.trim()] : [];
  return starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length).trim());
}

/**
 * A report that lists several themes, each with its own timer, as one report per theme; each part keeps the date line above the first.
 * A report with one theme (or timers that don't match the themes) comes back whole.
 */
export function splitThemes(report: string): string[] {
  const themeStarts = [...report.matchAll(/^[ 	]*theme\s*name/gim)].map((m) => m.index ?? 0);
  if (themeStarts.length < 2) return [report];
  const header = report.slice(0, themeStarts[0]).trim();
  const parts = themeStarts.map((start, i) => report.slice(start, themeStarts[i + 1] ?? report.length).trim());
  // Only when every theme has its own timer; otherwise it is one report that happens to mention "Theme Name" twice.
  if (!parts.every((part) => TIMER_RE.test(part))) return [report];
  return parts.map((part) => (header ? `${header}
${part}` : part));
}
