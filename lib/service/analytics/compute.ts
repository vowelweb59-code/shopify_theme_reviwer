import { capacityForWeek, rateOf, type DailyRule, type PerfEntry, type PerfProject } from "../performance/compute";
import { baMatch } from "../ba-members";
import { bdMatch } from "../bd-members";
import { weekOf } from "../import/week";

// Service analytics (owner, 2026-11-21): the team's record over a chosen range, in the shape project-management dashboards use: headline
// numbers, the weekly rhythm (hours and utilisation against capacity), top clients with how concentrated the money is, best weeks, the heaviest
// person-weeks (hours and capacity), teammate leaderboards, and the portfolio (status mix, ratings, profiles, BD / BA). Digital Marketing
// members' hours only (the same entries as Team performance); value = hours x the project's rate. Pure: `load.ts` feeds it.

export interface AProject extends PerfProject {
  clientId: string | null;
  profile: string | null;
  people: Array<{ role: string; name: string }>;
}

export interface AnalyticsInput {
  projects: readonly AProject[];
  clientNames: Readonly<Record<string, string>>;
  entries: readonly PerfEntry[];
  /** IST today. Entries after it are typing errors. */
  today: string;
  /** First day of the range, or null for all time. */
  fromDate: string | null;
  capacityMinutes: number;
  capacityByMember: Readonly<Record<string, number>>;
  /** Members whose availability depends on the days they worked (Hamza). */
  dailyRules?: Readonly<Record<string, DailyRule>>;
}

export interface WeekLine {
  start: string;
  minutes: number;
  valueCents: number;
  capacityMinutes: number;
  utilization: number;
  members: number;
  clients: number;
  projects: number;
  current: boolean;
}
export interface MonthLine {
  month: string;
  minutes: number;
  valueCents: number;
  newProjects: number;
  newClients: number;
}
export interface ClientLine {
  clientId: string;
  name: string;
  minutes: number;
  valueCents: number;
  share: number;
  projects: number;
  rating: number | null;
  weeks: number;
  lastReport: string;
}
export interface PersonWeek {
  member: string;
  start: string;
  minutes: number;
  capacityMinutes: number;
  pct: number;
  projects: number;
}
export interface Teammate {
  key: string;
  minutes: number;
  valueCents: number;
  projects: number;
  ratedProjects: number;
  rating: number | null;
  activeWeeks: number;
  avgWeekMinutes: number;
  peakWeekMinutes: number;
  capacityMinutes: number;
  utilization: number;
}
export interface Slice {
  name: string;
  minutes: number;
  valueCents: number;
  projects: number;
}

export interface Analytics {
  kpis: {
    minutes: number;
    valueCents: number;
    clients: number;
    projects: number;
    weeks: number;
    avgWeekMinutes: number;
    utilization: number | null;
    rating: number | null;
    ratedProjects: number;
  };
  weekly: WeekLine[];
  monthly: MonthLine[];
  clients: ClientLine[];
  concentration: { top1: number; top3: number; top5: number };
  bestWeeks: { byHours: WeekLine[]; byValue: WeekLine[]; byUtilization: WeekLine[] };
  personWeeks: { byHours: PersonWeek[]; byCapacity: PersonWeek[] };
  teammates: Teammate[];
  profiles: Slice[];
  bds: Slice[];
  bas: Slice[];
  statusMix: Array<{ status: string; count: number }>;
  ratingHistogram: number[];
  /** Each member's newest report ever (not only in the range), to tell who is still reporting. */
  lastReportByMember: Record<string, string>;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekStartOf = (iso: string) => weekOf(iso).start;
const top = <T>(xs: readonly T[], n: number, by: (x: T) => number) => [...xs].sort((a, b) => by(b) - by(a)).slice(0, n);

export function computeAnalytics(input: AnalyticsInput): Analytics {
  const byId = new Map(input.projects.map((p) => [p.id, p]));
  const dayMap = new Map<string, number>();
  for (const e of input.entries)
    if (e.minutes > 0 && e.date <= input.today) dayMap.set(`${e.member}|${e.date}`, (dayMap.get(`${e.member}|${e.date}`) ?? 0) + e.minutes);
  // A member's availability in the week starting `week` (a half-day member against half a week, Hamza by the days he worked).
  const capOf = (member: string, week: string) =>
    capacityForWeek(member, week, {
      capacityMinutes: input.capacityMinutes,
      byMember: input.capacityByMember,
      daily: input.dailyRules,
      dayMinutes: (k, d) => dayMap.get(`${k}|${d}`) ?? 0,
    });
  const valueOf = (e: PerfEntry) => {
    const r = rateOf(byId.get(e.projectId)!);
    return r === null ? 0 : Math.round((e.minutes / 60) * r);
  };
  const all = input.entries.filter((e) => e.minutes > 0 && e.date <= input.today && byId.has(e.projectId));
  const inRange = input.fromDate ? all.filter((e) => e.date >= input.fromDate!) : all;
  const currentWeek = weekStartOf(input.today);
  const lastReportByMember: Record<string, string> = {};
  for (const e of all) if (e.date > (lastReportByMember[e.member] ?? "")) lastReportByMember[e.member] = e.date;

  // Weekly rhythm. A member counts toward a week's capacity when they reported in that week or the three before it.
  const weekMembers = new Map<string, Set<string>>();
  for (const e of all) {
    const w = weekStartOf(e.date);
    (weekMembers.get(w) ?? weekMembers.set(w, new Set()).get(w)!).add(e.member);
  }
  const capacityOfWeek = (w: string) => {
    const set = new Set<string>();
    for (let i = 0; i < 4; i++) for (const m of weekMembers.get(addDays(w, -7 * i)) ?? []) set.add(m);
    return [...set].reduce((n, m) => n + capOf(m, w), 0);
  };
  const wk = new Map<string, { minutes: number; value: number; members: Set<string>; clients: Set<string>; projects: Set<string> }>();
  for (const e of inRange) {
    const w = weekStartOf(e.date);
    const cur = wk.get(w) ?? { minutes: 0, value: 0, members: new Set(), clients: new Set(), projects: new Set() };
    cur.minutes += e.minutes;
    cur.value += valueOf(e);
    cur.members.add(e.member);
    cur.projects.add(e.projectId);
    const c = byId.get(e.projectId)!.clientId;
    if (c) cur.clients.add(c);
    wk.set(w, cur);
  }
  // Every week of the range appears, even a week with no hours.
  const firstWeek = input.fromDate ? weekStartOf(input.fromDate) : [...wk.keys()].sort()[0];
  const weekly: WeekLine[] = [];
  if (firstWeek) {
    for (let w = firstWeek; w <= currentWeek; w = addDays(w, 7)) {
      const cur = wk.get(w);
      const cap = capacityOfWeek(w);
      weekly.push({
        start: w,
        minutes: cur?.minutes ?? 0,
        valueCents: cur?.value ?? 0,
        capacityMinutes: cap,
        utilization: cap ? (cur?.minutes ?? 0) / cap : 0,
        members: cur?.members.size ?? 0,
        clients: cur?.clients.size ?? 0,
        projects: cur?.projects.size ?? 0,
        current: w === currentWeek,
      });
    }
  }
  const finished = weekly.filter((w) => !w.current);

  // Months and new work (a project / client counts as new in the month of its first report ever).
  const firstProject = new Map<string, string>();
  const firstClient = new Map<string, string>();
  for (const e of all) {
    if (!firstProject.has(e.projectId) || e.date < firstProject.get(e.projectId)!) firstProject.set(e.projectId, e.date);
    const c = byId.get(e.projectId)!.clientId;
    if (c && (!firstClient.has(c) || e.date < firstClient.get(c)!)) firstClient.set(c, e.date);
  }
  const mo = new Map<string, MonthLine>();
  const month = (m: string) => mo.get(m) ?? mo.set(m, { month: m, minutes: 0, valueCents: 0, newProjects: 0, newClients: 0 }).get(m)!;
  for (const e of inRange) {
    const l = month(e.date.slice(0, 7));
    l.minutes += e.minutes;
    l.valueCents += valueOf(e);
  }
  const fromMonth = input.fromDate?.slice(0, 7) ?? "";
  for (const d of firstProject.values()) if (d.slice(0, 7) >= fromMonth) month(d.slice(0, 7)).newProjects++;
  for (const d of firstClient.values()) if (d.slice(0, 7) >= fromMonth) month(d.slice(0, 7)).newClients++;
  const monthly = [...mo.values()].sort((a, b) => a.month.localeCompare(b.month));

  // Clients.
  const cl = new Map<
    string,
    { minutes: number; value: number; projects: Set<string>; weeks: Set<string>; last: string; rated: number; ratedMinutes: number }
  >();
  for (const e of inRange) {
    const p = byId.get(e.projectId)!;
    if (!p.clientId) continue;
    const c = cl.get(p.clientId) ?? { minutes: 0, value: 0, projects: new Set(), weeks: new Set(), last: e.date, rated: 0, ratedMinutes: 0 };
    c.minutes += e.minutes;
    c.value += valueOf(e);
    c.projects.add(p.id);
    c.weeks.add(weekStartOf(e.date));
    if (e.date > c.last) c.last = e.date;
    if (p.reviewRating !== null) {
      c.rated += p.reviewRating * e.minutes;
      c.ratedMinutes += e.minutes;
    }
    cl.set(p.clientId, c);
  }
  const totalValue = inRange.reduce((n, e) => n + valueOf(e), 0);
  const totalMinutes = inRange.reduce((n, e) => n + e.minutes, 0);
  const clients: ClientLine[] = [...cl]
    .map(([id, c]) => ({
      clientId: id,
      name: input.clientNames[id] ?? "Unknown client",
      minutes: c.minutes,
      valueCents: c.value,
      share: totalValue ? c.value / totalValue : 0,
      projects: c.projects.size,
      rating: c.ratedMinutes ? c.rated / c.ratedMinutes : null,
      weeks: c.weeks.size,
      lastReport: c.last,
    }))
    .sort((a, b) => b.valueCents - a.valueCents || b.minutes - a.minutes);
  const topShare = (n: number) => clients.slice(0, n).reduce((s, c) => s + c.share, 0);

  // Person-weeks (the heaviest weeks of one person), never the unfinished current week.
  const pw = new Map<string, { member: string; start: string; minutes: number; projects: Set<string> }>();
  for (const e of inRange) {
    const w = weekStartOf(e.date);
    if (w === currentWeek) continue;
    const k = `${e.member}|${w}`;
    const cur = pw.get(k) ?? { member: e.member, start: w, minutes: 0, projects: new Set() };
    cur.minutes += e.minutes;
    cur.projects.add(e.projectId);
    pw.set(k, cur);
  }
  const personWeeks: PersonWeek[] = [...pw.values()].map((x) => ({
    member: x.member,
    start: x.start,
    minutes: x.minutes,
    capacityMinutes: capOf(x.member, x.start),
    pct: x.minutes / capOf(x.member, x.start),
    projects: x.projects.size,
  }));

  // Teammates.
  const tm = new Map<
    string,
    { minutes: number; value: number; projects: Set<string>; weeks: Map<string, number>; rated: number; ratedMinutes: number; ratedProjects: Set<string> }
  >();
  for (const e of inRange) {
    const p = byId.get(e.projectId)!;
    const t = tm.get(e.member) ?? { minutes: 0, value: 0, projects: new Set(), weeks: new Map(), rated: 0, ratedMinutes: 0, ratedProjects: new Set() };
    t.minutes += e.minutes;
    t.value += valueOf(e);
    t.projects.add(p.id);
    const w = weekStartOf(e.date);
    t.weeks.set(w, (t.weeks.get(w) ?? 0) + e.minutes);
    if (p.reviewRating !== null) {
      t.rated += p.reviewRating * e.minutes;
      t.ratedMinutes += e.minutes;
      t.ratedProjects.add(p.id);
    }
    tm.set(e.member, t);
  }
  const teammates: Teammate[] = [...tm]
    .map(([key, t]) => {
      const done = [...t.weeks].filter(([w]) => w !== currentWeek).map(([, m]) => m);
      const avg = done.length ? done.reduce((n, m) => n + m, 0) / done.length : 0;
      const doneWeeks = [...t.weeks.keys()].filter((w) => w !== currentWeek);
      const cap = doneWeeks.length ? doneWeeks.reduce((n, w) => n + capOf(key, w), 0) / doneWeeks.length : capOf(key, currentWeek);
      return {
        key,
        minutes: t.minutes,
        valueCents: t.value,
        projects: t.projects.size,
        ratedProjects: t.ratedProjects.size,
        rating: t.ratedMinutes ? t.rated / t.ratedMinutes : null,
        activeWeeks: done.length,
        avgWeekMinutes: Math.round(avg),
        peakWeekMinutes: Math.max(0, ...done),
        capacityMinutes: Math.round(cap),
        utilization: cap ? avg / cap : 0,
      };
    })
    .sort((a, b) => b.valueCents - a.valueCents);

  // Portfolio.
  const slice = (nameOf: (p: AProject) => string[]): Slice[] => {
    const m = new Map<string, { minutes: number; value: number; projects: Set<string> }>();
    for (const e of inRange) {
      const p = byId.get(e.projectId)!;
      for (const name of nameOf(p)) {
        const c = m.get(name) ?? { minutes: 0, value: 0, projects: new Set() };
        c.minutes += e.minutes;
        c.value += valueOf(e);
        c.projects.add(p.id);
        m.set(name, c);
      }
    }
    return [...m]
      .map(([name, c]) => ({ name, minutes: c.minutes, valueCents: c.value, projects: c.projects.size }))
      .sort((a, b) => b.valueCents - a.valueCents);
  };
  // The same person written two ways ("Aliasger B", "Ali Asger Bagichawala") is one BD; a project counts once for each.
  const who = (role: string) => (p: AProject) => [
    ...new Set(
      p.people
        .filter((x) => x.role === role)
        .map((x) => (role === "BUSINESS_DEVELOPER" ? bdMatch(x.name)?.name : role === "BUSINESS_ANALYST" ? baMatch(x.name)?.name : undefined) ?? x.name)
    ),
  ];
  const statusCount = new Map<string, number>();
  for (const p of input.projects) statusCount.set(p.status, (statusCount.get(p.status) ?? 0) + 1);
  const ratingHistogram = [0, 0, 0, 0, 0];
  for (const p of input.projects) if (p.reviewRating !== null) ratingHistogram[Math.min(5, Math.max(1, Math.round(p.reviewRating))) - 1]++;

  // Headline.
  const ratedInRange = new Map<string, number>();
  let ratedSum = 0,
    ratedMinutes = 0;
  for (const e of inRange) {
    const p = byId.get(e.projectId)!;
    if (p.reviewRating !== null) {
      ratedSum += p.reviewRating * e.minutes;
      ratedMinutes += e.minutes;
      ratedInRange.set(p.id, p.reviewRating);
    }
  }
  const capTotal = finished.reduce((n, w) => n + w.capacityMinutes, 0);
  const doneMinutes = finished.reduce((n, w) => n + w.minutes, 0);

  return {
    kpis: {
      minutes: totalMinutes,
      valueCents: totalValue,
      clients: clients.length,
      projects: new Set(inRange.map((e) => e.projectId)).size,
      weeks: finished.length,
      avgWeekMinutes: finished.length ? Math.round(doneMinutes / finished.length) : 0,
      utilization: capTotal ? doneMinutes / capTotal : null,
      rating: ratedMinutes ? ratedSum / ratedMinutes : null,
      ratedProjects: ratedInRange.size,
    },
    weekly,
    monthly,
    clients,
    concentration: { top1: topShare(1), top3: topShare(3), top5: topShare(5) },
    bestWeeks: {
      byHours: top(finished, 5, (w) => w.minutes),
      byValue: top(finished, 5, (w) => w.valueCents),
      byUtilization: top(
        finished.filter((w) => w.capacityMinutes > 0),
        5,
        (w) => w.utilization
      ),
    },
    personWeeks: { byHours: top(personWeeks, 10, (x) => x.minutes), byCapacity: top(personWeeks, 10, (x) => x.pct) },
    teammates,
    profiles: slice((p) => (p.profile ? [p.profile] : ["No profile"])),
    bds: slice(who("BUSINESS_DEVELOPER")),
    bas: slice(who("BUSINESS_ANALYST")),
    statusMix: [...statusCount].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    ratingHistogram,
    lastReportByMember,
  };
}
