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

const DATE_RE = /date\W{0,5}(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/i;
const THEME_RE = /theme\s*name\s*[:\-–—]*\s*(.+)/i;
const MEMO_RE = /memo\s*[:\-–—]*\s*(.+)/i;
const TIMER_RE = /timer\s*[:\-–—]*\s*(\d{1,2})(?:\s*[.:]\s*(\d{1,2}))?\s*(?:hrs?|hours?)?/i;

export function parseReport(text: string): Result<ParsedReport> {
  const date = DATE_RE.exec(text);
  if (!date) return { ok: false, error: "No date found." };
  const [day, month, year] = [Number(date[1]), Number(date[2]), Number(date[3])];
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return { ok: false, error: `"${date[1]}-${date[2]}-${date[3]}" is not a real date.` };

  const theme = THEME_RE.exec(text);
  const themeParts = (theme?.[1] ?? "").split("|").map((p) => p.trim()).filter(Boolean);
  if (themeParts.length === 0) return { ok: false, error: "No theme name found." };

  const timer = TIMER_RE.exec(text);
  if (!timer) return { ok: false, error: "No timer found." };
  const hours = Number(timer[1]);
  const mins = timer[2] === undefined ? 0 : Number(timer[2].length === 1 ? `${timer[2]}0` : timer[2]);
  if (mins >= 60) return { ok: false, error: `Timer "${timer[0].trim()}" has more than 59 minutes.` };
  const minutes = hours * 60 + mins;
  if (minutes <= 0 || minutes > 24 * 60) return { ok: false, error: `Timer "${timer[0].trim()}" is not a plausible day.` };

  return { ok: true, value: { date: iso, themeParts, memo: (MEMO_RE.exec(text)?.[1] ?? "").trim(), minutes } };
}

/** Splits pasted text holding several reports: each one starts at a "Date" line. */
export function splitReports(text: string): string[] {
  const starts = [...text.matchAll(/^[ \t]*date\b/gim)].map((m) => m.index ?? 0);
  if (starts.length === 0) return text.trim() ? [text.trim()] : [];
  return starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length).trim());
}
