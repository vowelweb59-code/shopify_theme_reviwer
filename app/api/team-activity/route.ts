import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ChatReport } from "@/models/chat-report";
import { listTrackedMembers, dayKey, todayInIst } from "@/lib/chat/teamActivity";

// What each team member is working on now: their latest time report in the Theme Status Group, plus everything they reported the same day.
const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type Report = { memberId: unknown; sender: string; date: Date; postedAt: Date | null; createdAt: Date; themeName: string; kind: "theme" | "preset" | "update" | null; preset: string | null; memo: string; minutes: number };

/** What the report is work on: the theme being built, one of its presets, or its Update project. */
function workLabel(r: Report): string {
  if (r.kind === "preset") return r.preset ? `${r.themeName} · ${r.preset} preset` : `${r.themeName} · preset`;
  if (r.kind === "update") return `${r.themeName} Update`;
  return r.themeName;
}

export async function GET() {
  await connectToDatabase();
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const [members, reports] = await Promise.all([
    listTrackedMembers(),
    ChatReport.find({ date: { $gte: since } }).select("memberId sender date postedAt createdAt themeName kind preset memo minutes").lean<Report[]>(),
  ]);

  // Newest first: by day, then by the time posted within the day.
  const at = (r: Report) => (r.postedAt ?? r.createdAt).getTime();
  reports.sort((a, b) => b.date.getTime() - a.date.getTime() || at(b) - at(a));
  const todayIst = todayInIst();

  const byMember = new Map<string, Report[]>();
  const unmatched = new Map<string, Report[]>();
  for (const r of reports) {
    const bucket = r.memberId ? byMember : unmatched;
    const key = r.memberId ? String(r.memberId) : r.sender || "Unknown";
    bucket.set(key, [...(bucket.get(key) ?? []), r]);
  }

  const person = (name: string, designation: string | null, list: Report[]) => {
    const latest = list[0];
    if (!latest) return { name, designation, current: null, today: [], lastReportedOn: null, daysAgo: null };
    const day = dayKey(latest.date);
    const daysAgo = Math.round((new Date(todayIst).getTime() - new Date(day).getTime()) / DAY_MS);
    // The same work reported more than once that day (several memos on one theme) shows once, with its hours added up.
    const merged = new Map<string, { work: string; kind: Report["kind"]; memo: string; minutes: number }>();
    for (const r of list.filter((x) => dayKey(x.date) === day)) {
      const work = workLabel(r);
      const cur = merged.get(work);
      merged.set(work, { work, kind: r.kind, memo: cur?.memo || r.memo, minutes: (cur?.minutes ?? 0) + r.minutes });
    }
    return {
      name,
      designation,
      current: { work: workLabel(latest), kind: latest.kind, memo: latest.memo, postedAt: latest.postedAt ? latest.postedAt.toISOString() : null },
      today: [...merged.values()],
      lastReportedOn: day,
      daysAgo,
    };
  };

  return NextResponse.json({
    todayIst,
    people: members.map((m) => person(m.name, m.designation, byMember.get(String(m._id)) ?? [])),
    unmatched: [...unmatched].map(([sender, list]) => person(sender, null, list)),
  });
}
