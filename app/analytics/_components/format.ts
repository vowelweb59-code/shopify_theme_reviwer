// Display formatting only — every number arrives already calculated from
// /api/analytics/metrics/* (lib/analytics/engine). Nothing here computes a
// metric; it only turns one into text.

const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return integer.format(value);
}

/** For chart axes, where "12.3K" fits and "12,345" doesn't. */
export function formatCompact(value: number): string {
  return Math.abs(value) >= 10_000 ? compact.format(value) : integer.format(Math.round(value));
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}

/** "Sep 18 – Sep 24, 2026" from two YYYY-MM-DD strings (dates are property-local, so no time-zone shifting). */
export function formatRange(range: { start: string; end: string } | null | undefined): string {
  if (!range) return "";
  const fmt = (d: string, withYear: boolean) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
  if (range.start === range.end) return fmt(range.start, true);
  return `${fmt(range.start, range.start.slice(0, 4) !== range.end.slice(0, 4))} – ${fmt(range.end, true)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** YYYY-MM-DD → epoch ms at UTC midnight, for chart x positions. */
export const dateToMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
