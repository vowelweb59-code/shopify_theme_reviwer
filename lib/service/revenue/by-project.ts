// Revenue by PROJECT (owner, 2026-11-21): every project of the app is listed, split in Active and Inactive for the chosen period, so the
// count matches the Projects tab. Active = the Digital Marketing team reported hours on it in the period, or money was taken for it (sales
// sheet); Inactive = every other project. The sheet holds money per client (and profile), not per project, so each sheet row is given to
// the project of that client whose Upwork profile matches the row's profile; with no (or no single) profile match it is shared between the
// client's projects by the team's hours that month (that period, then equally, when there are none). A project the sheet has no money for
// keeps an empty "We took" but is still listed. Pure.
import { matchClient } from "./match";
import { STANDARD_RATE_CENTS } from "../hours/fixed-budget";

/** A client of the app: its name and the other spellings the sales sheet may use for it. */
export interface AppClient {
  id: string;
  name: string;
  aliases: readonly string[];
}

/** What minutes of work were worth: at the project's rate, a fixed project with no rate at the standard $15/h, otherwise not priced (null). */
export function priceMinutes(minutes: number, type: "HOURLY" | "FIXED" | null, rateCents: number | null): number | null {
  const rate = rateCents ?? (type === "FIXED" ? STANDARD_RATE_CENTS : null);
  return rate === null ? null : (minutes / 60) * rate;
}

export interface RevProject {
  id: string;
  name: string;
  status: string;
  clientId: string | null;
  /** Normalised names of the project's Upwork profile (name and aliases). */
  profileKeys: readonly string[];
  type: "HOURLY" | "FIXED" | null;
  rateCents: number | null;
  /** Still marked Not started (or held because the team works on a Not started project): left out of Revenue, its hours shown apart. */
  notStarted?: boolean;
}
export interface ProjectHours {
  projectId: string;
  month: string;
  minutes: number;
}
export interface SheetRow {
  month: string;
  clientName: string;
  profile: string | null;
  amountCents: number;
}

export interface ProjectMonth {
  takenCents: number;
  shouldCents: number;
  minutes: number;
}
export interface ProjectLine {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  /** The sheet gave this project money in the period (otherwise "We took" stays empty). */
  hasSheetMoney: boolean;
  takenCents: number;
  minutes: number;
  /** Hours x rate (a fixed project with no rate at $15/h); hours of a project with no rate are in `unpricedMinutes`. */
  shouldCents: number;
  unpricedMinutes: number;
  active: boolean;
  months: Record<string, ProjectMonth>;
}
export interface ProjectRevenue {
  projects: ProjectLine[];
  /** Sheet money for a client that has no project in the app. */
  sheetOnly: Array<{ name: string; cents: number }>;
  fuzzy: Array<{ sheet: string; client: string }>;
}

export const profileKey = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function revenueByProject(
  input: { projects: readonly RevProject[]; clients: readonly AppClient[]; hours: readonly ProjectHours[]; taken: readonly SheetRow[] },
  from: string,
  to: string
): ProjectRevenue {
  const nameOf = new Map(input.clients.map((c) => [c.id, c.name]));
  const names = input.clients.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] }));
  const cache = new Map<string, ReturnType<typeof matchClient>>();
  const matchOf = (n: string) => {
    let m = cache.get(n);
    if (!m) {
      m = matchClient(n, names);
      cache.set(n, m);
    }
    return m;
  };

  const lines = new Map<string, ProjectLine>();
  for (const p of input.projects) {
    lines.set(p.id, {
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.clientId ? (nameOf.get(p.clientId) ?? null) : null,
      hasSheetMoney: false,
      takenCents: 0,
      minutes: 0,
      shouldCents: 0,
      unpricedMinutes: 0,
      active: false,
      months: {},
    });
  }
  const month = (l: ProjectLine, m: string) => (l.months[m] ??= { takenCents: 0, shouldCents: 0, minutes: 0 });
  const byId = new Map(input.projects.map((p) => [p.id, p]));

  // Hours in the period (and per project and month, for sharing a client's money).
  const hoursIn = new Map<string, number>();
  const hoursAt = new Map<string, number>();
  for (const h of input.hours) {
    const p = byId.get(h.projectId);
    if (!p || h.minutes <= 0 || h.month < from || h.month > to) continue;
    const l = lines.get(h.projectId)!;
    l.minutes += h.minutes;
    month(l, h.month).minutes += h.minutes;
    const cents = priceMinutes(h.minutes, p.type, p.rateCents);
    if (cents === null) l.unpricedMinutes += h.minutes;
    else {
      l.shouldCents += cents;
      month(l, h.month).shouldCents += cents;
    }
    hoursIn.set(h.projectId, (hoursIn.get(h.projectId) ?? 0) + h.minutes);
    hoursAt.set(`${h.projectId}|${h.month}`, (hoursAt.get(`${h.projectId}|${h.month}`) ?? 0) + h.minutes);
  }

  const byClient = new Map<string, RevProject[]>();
  for (const p of input.projects) if (p.clientId) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);
  const sheetOnly = new Map<string, number>();
  const fuzzy = new Map<string, string>();

  for (const t of input.taken) {
    if (t.month < from || t.month > to) continue;
    const m = matchOf(t.clientName);
    const candidates = m.clientId ? (byClient.get(m.clientId) ?? []) : [];
    if (m.clientId === null || candidates.length === 0) {
      sheetOnly.set(t.clientName, (sheetOnly.get(t.clientName) ?? 0) + t.amountCents);
      continue;
    }
    if (m.how === "fuzzy") fuzzy.set(t.clientName, nameOf.get(m.clientId) ?? m.clientId);
    const profile = profileKey(t.profile);
    const byProfile = profile ? candidates.filter((p) => p.profileKeys.includes(profile)) : [];
    const pool = byProfile.length ? byProfile : candidates;
    // Share the row between the pool: by that month's hours, else the period's hours, else equally.
    let weights = pool.map((p) => hoursAt.get(`${p.id}|${t.month}`) ?? 0);
    if (!weights.some((w) => w > 0)) weights = pool.map((p) => hoursIn.get(p.id) ?? 0);
    if (!weights.some((w) => w > 0)) weights = pool.map(() => 1);
    const total = weights.reduce((n, w) => n + w, 0);
    pool.forEach((p, i) => {
      const share = (t.amountCents * weights[i]!) / total;
      const l = lines.get(p.id)!;
      l.takenCents += share;
      l.hasSheetMoney = true;
      month(l, t.month).takenCents += share;
    });
  }

  const projects = [...lines.values()];
  for (const l of projects) l.active = l.minutes > 0 || (l.hasSheetMoney && l.takenCents !== 0);
  return {
    projects,
    sheetOnly: [...sheetOnly].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents),
    fuzzy: [...fuzzy].map(([sheet, client]) => ({ sheet, client })).sort((a, b) => a.sheet.localeCompare(b.sheet)),
  };
}
