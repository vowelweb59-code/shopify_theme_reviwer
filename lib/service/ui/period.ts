// Ported from the Upwork Project-Management web app (lib/period.ts).
// The period filter for the dashboard tabs. Everything is calendar days in IST; the period lives in the URL so a view can
// be bookmarked or shared. Day, week (Monday to Sunday) and month step with arrows; last 7, last 30 and custom do not.
export type Granularity = 'day' | 'week' | 'month' | 'last7' | 'last30' | 'custom';

export interface Period {
  g: Granularity;
  /** The day the view is anchored to (day, week and month). */
  anchor: string;
  from: string;
  to: string;
  label: string;
}

export const GRANULARITIES: Array<{ g: Granularity; label: string }> = [
  { g: 'day', label: 'Day' },
  { g: 'week', label: 'Week' },
  { g: 'month', label: 'Month' },
  { g: 'last7', label: 'Last 7 days' },
  { g: 'last30', label: 'Last 30 days' },
  { g: 'custom', label: 'Custom' },
];

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const valid = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

function monthBounds(anchor: string) {
  const d = new Date(`${anchor}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  return { from: iso(start), to: iso(end) };
}

export function resolvePeriod(sp: { g?: string; d?: string; from?: string; to?: string }): Period {
  const today = todayIST();
  const g = (GRANULARITIES.some((x) => x.g === sp.g) ? sp.g : 'week') as Granularity;
  const anchor = valid(sp.d) ? sp.d : today;
  switch (g) {
    case 'day':
      return { g, anchor, from: anchor, to: anchor, label: longDay(anchor) };
    case 'month': {
      const b = monthBounds(anchor);
      return { g, anchor, ...b, label: new Date(`${b.from}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
    }
    case 'last7':
      return { g, anchor: today, from: iso(ms(today) - 6 * DAY_MS), to: today, label: `Last 7 days · ${shortDay(iso(ms(today) - 6 * DAY_MS))} – ${shortDay(today)}` };
    case 'last30':
      return { g, anchor: today, from: iso(ms(today) - 29 * DAY_MS), to: today, label: `Last 30 days · ${shortDay(iso(ms(today) - 29 * DAY_MS))} – ${shortDay(today)}` };
    case 'custom': {
      let from = valid(sp.from) ? sp.from : iso(ms(today) - 29 * DAY_MS);
      let to = valid(sp.to) ? sp.to : today;
      if (from > to) [from, to] = [to, from];
      if (ms(to) - ms(from) > 365 * DAY_MS) from = iso(ms(to) - 365 * DAY_MS);
      return { g, anchor: to, from, to, label: `${shortDay(from)} – ${shortDay(to)}` };
    }
    default: {
      const sinceMonday = (new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7;
      const from = iso(ms(anchor) - sinceMonday * DAY_MS);
      const to = iso(ms(from) + 6 * DAY_MS);
      return { g: 'week', anchor, from, to, label: `${shortDay(from)} – ${shortDay(to)}` };
    }
  }
}

/** The anchor day one step before or after, for the arrows. Null for periods that do not step. */
export function stepAnchor(p: Period, dir: -1 | 1): string | null {
  if (p.g === 'day') return iso(ms(p.anchor) + dir * DAY_MS);
  if (p.g === 'week') return iso(ms(p.anchor) + dir * 7 * DAY_MS);
  if (p.g === 'month') {
    const d = new Date(`${p.anchor}T00:00:00Z`);
    return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1));
  }
  return null;
}

/** Query string for the API. */
export const apiRange = (p: Period) => `from=${p.from}&to=${p.to}`;

export const fmtDeltaPeriod = (now: number, before: number, fmt: (m: number) => string): string => {
  const d = now - before;
  return d === 0 ? 'same as the period before' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} vs the period before`;
};
