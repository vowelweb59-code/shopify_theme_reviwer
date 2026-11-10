import "server-only";
// Team view (ported from the Upwork app's team.controller.ts): who worked on which projects and how much, per week. The team
// are the Chat senders of TIMER STATUS. One shared login, so the salary is shown and editable for everyone signed in.
import { badRequest, notFound, oneOf, str } from "./http";
import { buildPeople, loadContext, loadEntryRows, summarise, type Row } from "./reports";
import { recordServiceAudit } from "../audit/record";
import { istDate } from "../import/text";
import { weekOf } from "../import/week";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceUser } from "@/models/service-user";

const DAY_MS = 86_400_000;
const WORKING_DAYS = 6; // the team works Monday to Saturday
const HISTORY_WEEKS = 6;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const shift = (start: string, weeks: number) => dayOf(new Date(Date.parse(start) + weeks * 7 * DAY_MS));

function week(raw?: string | null) {
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw badRequest("week must be YYYY-MM-DD");
  return weekOf(raw || istDate(new Date()));
}

/** Everyone with hours this week or last, most hours first. */
export async function teamList(weekRaw?: string | null) {
  const w = week(weekRaw);
  const { people } = await buildPeople(await loadContext(), { from: w.start, to: w.end, days: 7 });
  const shown = people.map(({ rows: _rows, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    week: w,
    totals: { minutes: shown.reduce((n, p) => n + p.minutes, 0), people: shown.filter((p) => p.minutes > 0).length, flagged: shown.reduce((n, p) => n + p.flagged, 0) },
    people: shown,
  };
}

type Sender = { _id: string; externalId: string; displayName: string; userId: string | null; designation: string | null; team: string | null; salaryMonthlyMinor: number | null; salaryCurrency: string };

async function sender(id: string): Promise<Sender> {
  const row = await ServiceChatSender.findById(id).lean<Sender | null>();
  if (!row) throw notFound("Team member not found.");
  return row;
}

export async function teamDetail(id: string, weekRaw?: string | null) {
  const s = await sender(id);
  const w = week(weekRaw);
  const first = shift(w.start, -(HISTORY_WEEKS - 1));
  const [all, user] = await Promise.all([
    loadEntryRows(await loadContext(), first, w.end, s.externalId),
    s.userId ? ServiceUser.findById(s.userId).select("displayName").lean<{ _id: string; displayName: string } | null>() : null,
  ]);
  const inWeek = (start: string) => all.filter((r: Row) => r.entryDate >= start && r.entryDate <= weekOf(start).end);
  const current = inWeek(w.start);
  const prevMinutes = inWeek(shift(w.start, -1)).reduce((n, r) => n + r.minutes, 0);

  const byDay = Array.from({ length: 7 }, (_, i) => {
    const date = dayOf(new Date(Date.parse(w.start) + i * DAY_MS));
    return { date, minutes: current.filter((r) => r.entryDate === date).reduce((n, r) => n + r.minutes, 0) };
  });
  const split = new Map<string, { project: string; client: string | null; minutes: number; entries: number }>();
  for (const r of current) {
    const k = `${r.project}\u0000${r.client ?? ""}`;
    const v = split.get(k) ?? { project: r.project, client: r.client, minutes: 0, entries: 0 };
    v.minutes += r.minutes;
    v.entries++;
    split.set(k, v);
  }
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, i) => {
    const start = shift(w.start, i - (HISTORY_WEEKS - 1));
    return { start, minutes: inWeek(start).reduce((n, r) => n + r.minutes, 0) };
  });
  const { previousMinutes: _p, ...summary } = summarise(current, prevMinutes, WORKING_DAYS); // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    week: w,
    person: { id: s._id, name: s.displayName, user: user ? { id: user._id, displayName: user.displayName } : null },
    profile: { designation: s.designation, team: s.team, salary: { monthly: s.salaryMonthlyMinor === null ? null : s.salaryMonthlyMinor / 100, currency: s.salaryCurrency } },
    ...summary,
    lastReportAt: summary.lastReportAt?.toISOString() ?? null,
    byDay,
    byProject: [...split.values()].sort((a, b) => b.minutes - a.minutes),
    weeks,
    recent: [...current].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime()).slice(0, 30)
      .map((r) => ({ id: r.id, entryDate: r.entryDate, project: r.project, client: r.client, minutes: r.minutes, source: r.source, memo: r.memo, flagged: r.flagged, late: r.late })),
  };
}
export type TeamDetail = Awaited<ReturnType<typeof teamDetail>>;

/** Designation and team. */
export async function setProfile(id: string, body: Record<string, unknown>) {
  const s = await sender(id);
  const designation = str(body.designation, "designation", { max: 100, optional: true });
  const team = str(body.team, "team", { max: 100, optional: true });
  await ServiceChatSender.updateOne({ _id: s._id }, { $set: { designation, team } });
  await recordServiceAudit("team_member.profile_set", { senderId: s._id });
  return { id: s._id };
}

/** Monthly salary. The amount is never written to the audit log. */
export async function setSalary(id: string, body: Record<string, unknown>) {
  const s = await sender(id);
  const raw = body.monthly;
  let monthly: number | null = null;
  if (raw !== null && raw !== undefined && raw !== "") {
    monthly = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(monthly) || monthly < 0 || monthly > 20_000_000) throw badRequest("monthly must be a number between 0 and 20,000,000.");
  }
  const currency = body.currency === undefined ? s.salaryCurrency : oneOf(body.currency, "currency", ["INR", "USD"] as const);
  await ServiceChatSender.updateOne({ _id: s._id }, { $set: { salaryMonthlyMinor: monthly === null ? null : Math.round(monthly * 100), salaryCurrency: currency } });
  await recordServiceAudit("team_member.salary_set", { senderId: s._id });
  return { id: s._id };
}
