// Calendar-date helpers for GA4 sync. GA4 buckets every event into a date in
// the *property's* time zone, so all dates here are plain "YYYY-MM-DD"
// strings (lexicographically sortable) computed in that zone — never Date
// objects, whose server-time-zone midnight would shift days.

/** The Data API serves nothing earlier than this, for any property. */
export const GA4_EARLIEST_DATE = "2015-08-14";

function formatInZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function todayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  return formatInZone(now, timeZone || "UTC");
}

/** The property-local date of an instant, e.g. a property's createTime. */
export function dateInTimeZone(isoInstant: string, timeZone: string | null | undefined): string {
  return formatInZone(new Date(isoInstant), timeZone || "UTC");
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "20260923" (GA4's `date` dimension) → "2026-09-23". */
export function fromGa4Date(value: string): string {
  if (!/^\d{8}$/.test(value)) throw new Error(`Unexpected GA4 date "${value}".`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);

/** Splits [start, end] (inclusive) into consecutive chunks of at most `days` days. */
export function chunkDateRange(start: string, end: string, days: number): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, days)) {
    chunks.push({ start: cursor, end: minDate(addDays(cursor, days - 1), end) });
  }
  return chunks;
}
