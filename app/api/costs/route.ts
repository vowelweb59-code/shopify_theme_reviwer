import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { computeThemeCosts, HOURS_PER_MONTH, WORKING_DAYS_PER_MONTH, type HoursInput, type Person } from "@/lib/projects/cost";
import { rejectionCount } from "@/lib/projects/rounds";
import { fixedDayInputs } from "@/lib/projects/fixedDayInputs";
import { loadPerLive } from "@/lib/projects/loadPerLive";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { Theme } from "@/models/theme";
import { TimeEntry } from "@/models/time-entry";

/**
 * What each theme cost to make (lib/projects/cost.ts): every reported hour on the theme priced at its reporter's hourly cost
 * (monthly salary / 221 h), split into build, presets and updates. Hours come from the Chat time reports (status ok, matched member)
 * plus hours entered by hand in Theme Update hours logs (the ones made from Chat reports are the same hours as those reports, so only
 * entries without a chatReportKey are added). The days entered by hand on older projects have no person, so they are listed as
 * `fixedDays` and are not priced.
 */
export async function GET() {
  await connectToDatabase();
  const [members, themes, reports, manual, projects] = await Promise.all([
    TeamMember.find().select("name designation monthlySalary inactive").lean<{ _id: unknown; name: string; designation: string; monthlySalary?: number | null; inactive?: boolean }[]>(),
    Theme.find().select("name themeStoreLive").lean<{ _id: unknown; name: string; themeStoreLive?: boolean | null }[]>(),
    ChatReport.find({ status: "ok", memberId: { $ne: null }, themeId: { $ne: null }, kind: { $in: ["theme", "preset", "update"] } })
      .select("themeId memberId kind minutes date")
      .lean<{ themeId: unknown; memberId: unknown; kind: "theme" | "preset" | "update"; minutes: number; date: Date }[]>(),
    TimeEntry.find({ chatReportKey: { $not: { $type: "string" } } }).select("projectId memberId hours date").lean<{ projectId: unknown; memberId: unknown; hours: number; date: Date }[]>(),
    Project.find().select("themeId type status rejectedOn rounds designDays developmentDays designDaysBy developmentDaysBy designDaysSplit developmentDaysSplit").lean<{ _id: unknown; themeId: unknown; type?: string | null; status: string | null; rejectedOn?: Date | null; rounds?: { status: string; rejectedOn?: Date | null }[]; designDays?: number | null; developmentDays?: number | null; designDaysBy?: unknown; developmentDaysBy?: unknown; designDaysSplit?: { memberId: unknown; share: number }[]; developmentDaysSplit?: { memberId: unknown; share: number }[] }[]>(),
  ]);

  const { payments, perLiveIds } = await loadPerLive();
  const people = new Map<string, Person>(members.map((m) => [String(m._id), { name: m.name, designation: m.designation, monthlySalary: m.monthlySalary ?? null, perLive: perLiveIds.has(String(m._id)) }]));
  const themeOfProject = new Map(projects.map((p) => [String(p._id), String(p.themeId)]));

  const inputs: HoursInput[] = [];
  for (const r of reports) {
    inputs.push({ themeId: String(r.themeId), memberId: String(r.memberId), line: r.kind === "theme" ? "build" : r.kind === "preset" ? "presets" : "updates", hours: r.minutes / 60, month: r.date.toISOString().slice(0, 7), day: r.date.toISOString().slice(0, 10) });
  }
  for (const e of manual) {
    const themeId = themeOfProject.get(String(e.projectId));
    if (themeId) inputs.push({ themeId, memberId: String(e.memberId), line: "updates", hours: e.hours, month: e.date.toISOString().slice(0, 7), day: e.date.toISOString().slice(0, 10) });
  }
  // Days entered by hand that one person worked (manual sheet): priced as undated build hours.
  inputs.push(...fixedDayInputs(projects, (p) => String(p.themeId)));
  // The first version's rejection date per theme: the earliest rejection date entered on its Theme Design & Development project(s).
  const firstRejection = new Map<string, string>();
  for (const p of projects) {
    if ((p.type ?? "theme_development") !== "theme_development") continue;
    const dates = [...(p.rounds ?? []).filter((r) => r.status === "rejected").map((r) => r.rejectedOn), p.status === "rejected" ? p.rejectedOn : null]
      .filter((d): d is Date => Boolean(d))
      .map((d) => new Date(d).toISOString().slice(0, 10));
    const theme = String(p.themeId);
    for (const d of dates) if (!firstRejection.has(theme) || d < (firstRejection.get(theme) as string)) firstRejection.set(theme, d);
  }
  // Per-live commission, keyed by the theme its project belongs to.
  const costs = computeThemeCosts(inputs, people, firstRejection, payments.map((p) => ({ themeId: p.themeId, memberId: p.memberId, line: p.line, amount: p.amount, month: p.month })));

  const rejections = new Map<string, number>();
  const fixedDays = new Map<string, number>();
  for (const p of projects) {
    if (p.type === "theme_update") continue;
    const theme = String(p.themeId);
    rejections.set(theme, (rejections.get(theme) ?? 0) + rejectionCount(p));
    fixedDays.set(theme, (fixedDays.get(theme) ?? 0) + (p.designDays ?? 0) + (p.developmentDays ?? 0));
  }

  const rows = themes
    .filter((t) => costs.has(String(t._id)) || (fixedDays.get(String(t._id)) ?? 0) > 0)
    .map((t) => {
      const id = String(t._id);
      return {
        themeId: id,
        name: t.name,
        live: t.themeStoreLive !== false,
        ...(costs.get(id) ?? { cost: { build: 0, presets: 0, updates: 0, total: 0 }, hours: { build: 0, presets: 0, updates: 0, total: 0 }, unpricedHours: 0, people: [], byMonth: [], rework: null }),
        rejections: rejections.get(id) ?? 0,
        fixedDays: Math.round((fixedDays.get(id) ?? 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.cost.total - a.cost.total || a.name.localeCompare(b.name));

  // People who reported hours but have no salary entered: their hours are in the totals, unpriced. Inactive members are not asked for.
  const inactiveIds = new Set(members.filter((m) => m.inactive).map((m) => String(m._id)));
  const missing = new Map<string, { name: string; designation: string; hours: number }>();
  for (const row of rows) {
    for (const p of row.people) {
      if (p.cost !== null || !people.has(p.memberId) || inactiveIds.has(p.memberId)) continue;
      const entry = missing.get(p.memberId) ?? { name: p.name, designation: p.designation, hours: 0 };
      entry.hours = Math.round((entry.hours + p.hours) * 10) / 10;
      missing.set(p.memberId, entry);
    }
  }

  // All themes together, per month worked.
  const monthTotals = new Map<string, { cost: number; hours: number }>();
  for (const row of rows) {
    for (const m of row.byMonth) {
      const t = monthTotals.get(m.month) ?? { cost: 0, hours: 0 };
      t.cost += m.cost;
      t.hours = Math.round((t.hours + m.hours) * 10) / 10;
      monthTotals.set(m.month, t);
    }
  }
  const months = [...monthTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, t]) => ({ month, ...t }));

  return NextResponse.json({
    rate: { workingDaysPerMonth: WORKING_DAYS_PER_MONTH, hoursPerMonth: HOURS_PER_MONTH },
    totals: { cost: rows.reduce((n, r) => n + r.cost.total, 0), hours: Math.round(rows.reduce((n, r) => n + r.hours.total, 0) * 10) / 10 },
    months,
    missingSalary: [...missing.values()].sort((a, b) => b.hours - a.hours),
    themes: rows,
  });
}
