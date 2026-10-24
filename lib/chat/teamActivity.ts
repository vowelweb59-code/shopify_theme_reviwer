import { ChatReport } from "@/models/chat-report";
import { TeamMember } from "@/models/team-member";

// Who the Current Work page tracks, and which days each of them did not send a time report.
// People left off by name or designation (only on these pages; the Team page and their stored reports are unchanged).
const HIDDEN_NAMES = new Set(["dharmandra"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Someone with no report for this long is taken to have left or moved off reporting; days after their last report aren't counted as missed. */
const INACTIVE_AFTER_DAYS = 14;

export type TrackedMember = { _id: unknown; name: string; designation: string };

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const todayInIst = () => dayKey(new Date(Date.now() + IST_OFFSET_MS));

export function isTracked(m: { name: string; designation: string }): boolean {
  return !/product\s*manager/i.test(m.designation) && !HIDDEN_NAMES.has(m.name.trim().toLowerCase());
}

export async function listTrackedMembers(): Promise<TrackedMember[]> {
  const members = await TeamMember.find().select("name designation").sort({ name: 1 }).lean<TrackedMember[]>();
  return members.filter(isTracked);
}

export type DayCell = { status: "reported"; minutes: number } | { status: "missed" } | { status: "none" };
export type MissedGrid = {
  month: string;
  /** Working days of the month so far: Monday to Saturday, a day at least one person reported, up to yesterday (IST). */
  days: string[];
  rows: { name: string; designation: string; cells: DayCell[]; reported: number; missed: number }[];
};

/** Month is "YYYY-MM". */
export async function missedReportsForMonth(month: string): Promise<MissedGrid> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const today = todayInIst();

  const [members, monthReports, spans] = await Promise.all([
    listTrackedMembers(),
    ChatReport.find({ date: { $gte: start, $lt: end } }).select("memberId date minutes").lean<{ memberId: unknown; date: Date; minutes: number }[]>(),
    ChatReport.aggregate<{ _id: unknown; first: Date; last: Date }>([{ $match: { memberId: { $ne: null } } }, { $group: { _id: "$memberId", first: { $min: "$date" }, last: { $max: "$date" } } }]),
  ]);

  // A working day is a Monday-to-Saturday on which somebody reported (a holiday has no reports at all); today is still open.
  const reportedDays = new Set(monthReports.map((r) => dayKey(r.date)));
  const days = [...reportedDays].filter((d) => d < today && new Date(d).getUTCDay() !== 0).sort();

  const minutesBy = new Map<string, number>();
  for (const r of monthReports) if (r.memberId) minutesBy.set(`${r.memberId}|${dayKey(r.date)}`, (minutesBy.get(`${r.memberId}|${dayKey(r.date)}`) ?? 0) + r.minutes);
  const span = new Map(spans.map((s) => [String(s._id), { first: dayKey(s.first), last: dayKey(s.last) }]));

  const rows = members.map((m) => {
    const id = String(m._id);
    const own = span.get(id);
    const inactive = own ? (new Date(today).getTime() - new Date(own.last).getTime()) / DAY_MS > INACTIVE_AFTER_DAYS : true;
    const cells = days.map<DayCell>((d) => {
      const minutes = minutesBy.get(`${id}|${d}`);
      if (minutes !== undefined) return { status: "reported", minutes };
      // Not expected before their first report, or after the last one once they have gone quiet.
      if (!own || d < own.first || (inactive && d > own.last)) return { status: "none" };
      return { status: "missed" };
    });
    return { name: m.name, designation: m.designation, cells, reported: cells.filter((c) => c.status === "reported").length, missed: cells.filter((c) => c.status === "missed").length };
  });

  // The ones who missed most first, so a pattern stands out.
  rows.sort((a, b) => b.missed - a.missed || a.name.localeCompare(b.name));
  return { month, days, rows };
}

/** The months with any report, newest first, for the month picker. */
export async function reportMonths(): Promise<string[]> {
  const dates = await ChatReport.distinct("date");
  return [...new Set((dates as Date[]).map((d) => dayKey(d).slice(0, 7)))].sort().reverse();
}
