// Team performance (owner, 2026-11-20): per Digital Marketing member, how occupied they are this week against their allocation, what they have
// completed, and their whole record: projects handled, hours, value earned, review ratings. Pure: the loader (`load.ts`) turns the database
// into these inputs.

/** 8 h 30 a day, Monday to Friday (Saturday is optional, see attendance): a member's weekly availability. */
export const WEEKLY_CAPACITY_MINUTES = 8.5 * 5 * 60;
/** Fixed-price work with no hourly rate is valued at the standard $15 an hour, as the Revenue tab does. */
export const STANDARD_RATE_CENTS = 1500;
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
  /** This member's part of the project's weekly allocation (0 when the project is not running or the team was idle for 30 days). */
  allocatedMinutes: number;
  /** The project's weekly quota, or its recent weekly pace when it has no quota. */
  weeklyMinutes: number;
  /** The member's share of the team's last 30 days on the project, 0 to 1. */
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
  /** Rating weighted by the member's hours on each rated project; null with no rated project. */
  weightedRating: number | null;
  simpleRating: number | null;
  weekMinutes: number;
  /** Average weekly hours over the last 4 weeks: what a usual week looks like, next to the allocation. */
  paceMinutes: number;
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
}

export const rateOf = (p: PerfProject): number | null => p.hourlyRateCents ?? (p.fixed ? STANDARD_RATE_CENTS : null);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function computePerformance(input: PerfInput): MemberPerformance[] {
  const capacity = input.capacityMinutes ?? WEEKLY_CAPACITY_MINUTES;
  const byId = new Map(input.projects.map((p) => [p.id, p]));
  const since30 = addDays(input.today, -29);
  const since28 = addDays(input.today, -27);
  const entries = input.entries.filter((e) => e.minutes > 0 && e.date <= input.today && byId.has(e.projectId));

  // The team's last 30 days on each project: the basis of each member's share, and (last 28 days / 4) the weekly pace of a project with no weekly quota.
  const team30 = new Map<string, number>();
  const team28 = new Map<string, number>();
  for (const e of entries) {
    if (e.date >= since30) team30.set(e.projectId, (team30.get(e.projectId) ?? 0) + e.minutes);
    if (e.date >= since28) team28.set(e.projectId, (team28.get(e.projectId) ?? 0) + e.minutes);
  }
  const weeklyAllocation = (p: PerfProject) => p.weeklyLimitMinutes ?? Math.round((team28.get(p.id) ?? 0) / 4);

  const members = new Map<string, MemberPerformance & { _p: Map<string, MemberProject> }>();
  const memberOf = (key: string) => {
    let m = members.get(key);
    if (!m) {
      m = { key, totalMinutes: 0, valueCents: 0, unpricedMinutes: 0, projectsHandled: 0, projectsNow: 0, ratedProjects: 0, weightedRating: null, simpleRating: null, weekMinutes: 0, paceMinutes: 0, allocatedMinutes: 0, occupancy: 0, lastReport: null, projects: [], byMonth: {}, _p: new Map() };
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
    if (e.date >= since28) m.paceMinutes += e.minutes;
    const mp = m._p.get(e.projectId) ?? { projectId: e.projectId, minutes: 0, valueCents: 0, rating: p.reviewRating, last30Minutes: 0, lastReport: e.date, allocatedMinutes: 0, weeklyMinutes: 0, share: 0 };
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
    const hours = rated.reduce((n, x) => n + x.minutes, 0);
    m.weightedRating = rated.length && hours ? rated.reduce((n, x) => n + x.rating! * x.minutes, 0) / hours : null;
    m.simpleRating = rated.length ? rated.reduce((n, x) => n + x.rating!, 0) / rated.length : null;
    // Allocation: for every running project the team reported on in the last 30 days, the project's weekly quota (or its recent weekly pace)
    // times the member's share of the team's last 30 days on it.
    for (const x of m.projects) {
      const p = byId.get(x.projectId)!;
      const total = team30.get(p.id) ?? 0;
      if (!ALLOCATED_STATUSES.includes(p.status) || x.last30Minutes === 0 || total === 0) continue;
      x.weeklyMinutes = weeklyAllocation(p);
      x.share = x.last30Minutes / total;
      x.allocatedMinutes = Math.round(x.weeklyMinutes * x.share);
      m.allocatedMinutes += x.allocatedMinutes;
    }
    m.paceMinutes = Math.round(m.paceMinutes / 4);
    m.occupancy = capacity ? m.allocatedMinutes / capacity : 0;
  }
  return [...members.values()].map(({ _p, ...m }) => (void _p, m));
}
