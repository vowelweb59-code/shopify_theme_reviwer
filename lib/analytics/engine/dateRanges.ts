import { GA4_DATE_PATTERN } from "../constants";
import { GA4_EARLIEST_DATE, addDays, todayInTimeZone } from "../sync/dates";

// Dashboard date ranges, resolved to inclusive "YYYY-MM-DD" bounds in a
// property's own time zone (GA4 buckets every event by property-local
// date, so "Today" means the property's today, not the server's).
//
// Presets follow GA4's own UI so numbers can be checked against it:
//   - "Last N days" end yesterday — today is still being collected.
//   - Weeks start on Sunday.
//   - The comparison period is the *preceding period*: the same number of
//     days immediately before the current range. So "This month" on the
//     25th compares against the 25 days before the 1st, not the 1st–25th of
//     last month, and "Last month" (30 days) against the 30 days before it.

export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "last90",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  last90: "Last 90 days",
  thisWeek: "This week",
  lastWeek: "Last week",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisYear: "This year",
  custom: "Custom range",
};

/** Bounds a custom range so one request can't scan a decade of rows. */
export const MAX_RANGE_DAYS = 3 * 366;

export type DateRange = { start: string; end: string };
export type DateRangeSpec = { preset: DateRangePreset; start?: string; end?: string };

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateRangeError";
  }
}

/** Whole days from a to b (b − a); both are YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Days in an inclusive range. */
export const rangeLength = (range: DateRange) => daysBetween(range.start, range.end) + 1;

/** Every date in an inclusive range, oldest first. */
export function datesInRange(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

function isRealDate(value: string): boolean {
  if (!GA4_DATE_PATTERN.test(value)) return false;
  // Month 13 or day 32 is an Invalid Date, whose toISOString() throws.
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday

function startOfMonth(date: string) {
  return `${date.slice(0, 8)}01`;
}

/** Resolves a preset (or validates a custom range) against a property-local "today". */
export function resolveRange(spec: DateRangeSpec, today: string): DateRange {
  const yesterday = addDays(today, -1);
  switch (spec.preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday":
      return { start: yesterday, end: yesterday };
    case "last7":
      return { start: addDays(today, -7), end: yesterday };
    case "last30":
      return { start: addDays(today, -30), end: yesterday };
    case "last90":
      return { start: addDays(today, -90), end: yesterday };
    case "thisWeek":
      return { start: addDays(today, -weekday(today)), end: today };
    case "lastWeek": {
      const thisSunday = addDays(today, -weekday(today));
      return { start: addDays(thisSunday, -7), end: addDays(thisSunday, -1) };
    }
    case "thisMonth":
      return { start: startOfMonth(today), end: today };
    case "lastMonth": {
      const lastDay = addDays(startOfMonth(today), -1);
      return { start: startOfMonth(lastDay), end: lastDay };
    }
    case "thisYear":
      return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case "custom": {
      const { start, end } = spec;
      if (!start || !end) throw new DateRangeError("A custom range needs both a start and an end date.");
      if (!isRealDate(start) || !isRealDate(end)) throw new DateRangeError("Dates must be real calendar dates in YYYY-MM-DD format.");
      if (start > end) throw new DateRangeError("The start date must be on or before the end date.");
      if (start < GA4_EARLIEST_DATE) throw new DateRangeError(`GA4 has no data before ${GA4_EARLIEST_DATE}.`);
      if (rangeLength({ start, end }) > MAX_RANGE_DAYS) throw new DateRangeError(`A custom range can cover at most ${MAX_RANGE_DAYS} days.`);
      return { start, end };
    }
  }
}

/** GA4's "Preceding period": the same number of days, ending the day before `range` starts. */
export function previousPeriod(range: DateRange): DateRange {
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(rangeLength(range) - 1)), end };
}

export type ResolvedPeriod = { current: DateRange; previous: DateRange | null };

/** Current range plus (optionally) its comparison range, in one property's time zone. */
export function resolvePeriod(spec: DateRangeSpec, timeZone: string | null | undefined, compare: boolean, now: Date = new Date()): ResolvedPeriod {
  const current = resolveRange(spec, todayInTimeZone(timeZone, now));
  return { current, previous: compare ? previousPeriod(current) : null };
}
