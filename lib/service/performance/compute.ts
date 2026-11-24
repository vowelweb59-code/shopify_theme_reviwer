// Team performance (owner, 2026-11-20): per Digital Marketing member, how occupied they are this week against their allocation, what they have
// completed, and their whole record: projects handled, hours, value earned, review ratings. A member's allocation is their USUAL hours on the
// running projects (average of the last 4 weeks), not the projects' quotas (owner, same day). Pure: the loader (`load.ts`) turns the
// database into these inputs.

import { memberRating } from "./score";
/** 8 h 30 a day, Monday to Friday (Saturday is optional, see attendance): a member's weekly availability. */
export const WEEKLY_CAPACITY_MINUTES = 8.5 * 5 * 60;
/** Fixed-price work with no hourly rate is valued at the standard $15 an hour, as the Revenue tab does. */
export const STANDARD_RATE_CENTS = 1500;
/** A full working day. */
export const FULL_DAY_MINUTES = 8.5 * 60;

/** A member whose availability depends on the day: a reported full day counts as full, every other weekday as a half day. */
export interface DailyRule {
  halfDayMinutes: number;
  fullDayFromMinutes: number;
}

/** A member's availability for the week starting `weekStart` (Monday). */
export function capacityForWeek(
  member: string,
  weekStart: string,
  o: {
    capacityMinutes: number;
    byMember?: Readonly<Record<string, number>>;
    daily?: Readonly<Record<string, DailyRule>>;
    dayMinutes: (member: string, date: string) => number;
  }
): number {
  const rule = o.daily?.[member];
  if (!rule) return o.byMember?.[member] ?? o.capacityMinutes;
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const date = new Date(Date.parse(`${weekStart}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    total += o.dayMinutes(member, date) >= rule.fullDayFromMinutes ? FULL_DAY_MINUTES : rule.halfDayMinutes;
  }
  return total;
}
/** Projects that count toward a member's allocation: running ones (not on hold, not moved, not closed). */
export const ALLOCATED_STATUSES = ["ACTIVE", "PARTIAL_HOLD"];

export interface PerfProject {
  id: string;
  name: string;
  status: string;
  /** The client's closing review, 1 to 5. */
  reviewRating: number | null;
  fixed: boolean;
  hourlyRateCents: number | null;
  weeklyLimitMinutes: number | null;
}

/** One counted entry of a team member, already placed on its project. */
export interface PerfEntry {
  projectId: string;
  member: string;
  minutes: number;
  /** IST day, YYYY-MM-DD. */
  date: string;
}

export interface MemberProject {
  projectId: string;
  minutes: number;
  valueCents: number;
  rating: number | null;
  last30Minutes: number;
  lastReport: string;
  last28Minutes: number;
  /** The member's usual week on this project: their last 28 days / 4 (0 when the project is not running). */
  allocatedMinutes: number;
  /** The team's usual week on the project (its last 28 days / 4). */
  weeklyMinutes: number;
  /** The member's share of the team's last 28 days on the project, 0 to 1. */
  share: number;
}

export interface MemberPerformance {
  key: string;
  totalMinutes: number;
  /** Hours x rate; hours on a project with no rate are in `unpricedMinutes`. */
  valueCents: number;
  unpricedMinutes: number;
  projectsHandled: number;
  /** Running projects the member reported on in the last 30 days. */
  projectsNow: number;
  ratedProjects: number;
  /** The member's score (see score.ts): every project counts, unrated ones as 3.5 stars, 5 / 1 / 2 stars weigh more; null with no hours. */
  weightedRating: number | null;
  simpleRating: number | null;
  weekMinutes: number;
  /** This member's weekly availability (the full week unless they work part-time). */
  capacityMinutes: number;
  allocatedMinutes: number;
  /** Allocated / capacity (can pass 1). */
  occupancy: number;
  lastReport: string | null;
  projects: MemberProject[];
  byMonth: Record<string, { minutes: number; valueCents: number }>;
}

export interface PerfInput {
  projects: readonly PerfProject[];
  entries: readonly PerfEntry[];
  /** IST today; entries dated after it are typing errors and are ignored. */
  today: string;
  weekStart: string;
  weekEnd: string;
  capacityMinutes?: number;
  /** Part-time members: their weekly availability by member key. */
  capacityByMember?: Record<string, number>;
  /** Members whose availability depends on the day they worked. */
  dailyRules?: Record<string, DailyRule>;
}

export const rateOf = (p: PerfProject): number | null => p.hourlyRateCents ?? (p.fixed ? STANDARD_RATE_CENTS : null);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function computePerformance(input: PerfInput): MemberPerformance[] {
  const capacity = input.capacityMinutes ?? WEEKLY_CAPACITY_MINUTES;
  const byId = new Map(input.projects.map((p) => [p.id, p]));
  const since30 = addDays(input.today, -29);
  const since28 = addDays(input.today, -27);
  const entries = input.entries.filter((e) => e.minutes > 0 && e.date <= input.today && byId.has(e.projectId));
  const dayMap = new Map<string, number>();
  for (const e of entries) dayMap.set(`${e.member}|${e.date}`, (dayMap.get(`${e.member}|${e.date}`) ?? 0) + e.minutes);

  // The team's last 28 days on each project (a member's share of it is shown beside their allocation).
  const team28 = new Map<string, number>();
  for (const e of entries) if (e.date >= since28) team28.set(e.projectId, (team28.get(e.projectId) ?? 0) + e.minutes);

  const members = new Map<string, MemberPerformance & { _p: Map<string, MemberProject> }>();
  const memberOf = (key: string) => {
    let m = members.get(key);
    if (!m) {
      m = {
        key,
        totalMinutes: 0,
        valueCents: 0,
        unpricedMinutes: 0,
        projectsHandled: 0,
        projectsNow: 0,
        ratedProjects: 0,
        weightedRating: null,
        simpleRating: null,
        weekMinutes: 0,
        capacityMinutes: capacity,
        allocatedMinutes: 0,
        occupancy: 0,
        lastReport: null,
        projects: [],
        byMonth: {},
        _p: new Map(),
      };
      members.set(key, m);
    }
    return m;
  };

  for (const e of entries) {
    const p = byId.get(e.projectId)!;
    const m = memberOf(e.member);
    const rate = rateOf(p);
    const value = rate === null ? 0 : Math.round((e.minutes / 60) * rate);
    m.totalMinutes += e.minutes;
    m.valueCents += value;
    if (rate === null) m.unpricedMinutes += e.minutes;
    if (e.date >= input.weekStart && e.date <= input.weekEnd) m.weekMinutes += e.minutes;
    if (!m.lastReport || e.date > m.lastReport) m.lastReport = e.date;
    const month = e.date.slice(0, 7);
    const mm = (m.byMonth[month] ??= { minutes: 0, valueCents: 0 });
    mm.minutes += e.minutes;
    mm.valueCents += value;
    const mp = m._p.get(e.projectId) ?? {
      projectId: e.projectId,
      minutes: 0,
      valueCents: 0,
      rating: p.reviewRating,
      last30Minutes: 0,
      last28Minutes: 0,
      lastReport: e.date,
      allocatedMinutes: 0,
      weeklyMinutes: 0,
      share: 0,
    };
    if (e.date >= since28) mp.last28Minutes += e.minutes;
    mp.minutes += e.minutes;
    mp.valueCents += value;
    if (e.date >= since30) mp.last30Minutes += e.minutes;
    if (e.date > mp.lastReport) mp.lastReport = e.date;
    m._p.set(e.projectId, mp);
  }

  for (const m of members.values()) {
    m.projects = [...m._p.values()].sort((a, b) => b.minutes - a.minutes);
    m.projectsHandled = m.projects.length;
    m.projectsNow = m.projects.filter((x) => x.last30Minutes > 0 && ALLOCATED_STATUSES.includes(byId.get(x.projectId)!.status)).length;
    const rated = m.projects.filter((x) => x.rating !== null);
    m.ratedProjects = rated.length;
    m.weightedRating = memberRating(m.projects);
    m.simpleRating = rated.length ? rated.reduce((n, x) => n + x.rating!, 0) / rated.length : null;
    // Allocation: the member's usual week on every running project, i.e. what they reported on it in the last 28 days / 4.
    for (const x of m.projects) {
      const p = byId.get(x.projectId)!;
      const total = team28.get(p.id) ?? 0;
      if (!ALLOCATED_STATUSES.includes(p.status) || x.last28Minutes === 0 || total === 0) continue;
      x.weeklyMinutes = Math.round(total / 4);
      x.share = x.last28Minutes / total;
      x.allocatedMinutes = Math.round(x.last28Minutes / 4);
      m.allocatedMinutes += x.allocatedMinutes;
    }
    m.capacityMinutes = capacityForWeek(m.key, input.weekStart, {
      capacityMinutes: capacity,
      byMember: input.capacityByMember,
      daily: input.dailyRules,
      dayMinutes: (k, d) => dayMap.get(`${k}|${d}`) ?? 0,
    });
    m.occupancy = m.capacityMinutes ? m.allocatedMinutes / m.capacityMinutes : 0;
  }
  return [...members.values()].map(({ _p, ...m }) => (void _p, m));
}
