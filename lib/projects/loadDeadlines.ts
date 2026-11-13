import { connectToDatabase } from "@/lib/db/connect";
import { dayKey, todayInIst } from "@/lib/chat/teamActivity";
import { deadlineInfo, FINISHED_STATUSES } from "@/lib/projects/deadlines";
import { addWorkingDays, averageDays, BENCHMARK_TYPES, daysFromHours, extraDays, type Benchmark, type BenchmarkType } from "@/lib/projects/benchmarks";
import { loadProjectTotals } from "@/lib/projects/loadTotals";
import type { ProjectStatus } from "@/lib/projects/constants";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";

/**
 * (Shared by GET /api/deadlines and GET /api/projects/[id]/deadline.)
 * Every project that has a due date (all but Theme Update, which is continuous) with its deadline state.
 * A theme project's last report is the latest new-theme report on its theme; a preset project's, the latest
 * preset report linked to it (the same scoping as lib/projects/loadTotals.ts).
 *
 * Average-based deadlines (lib/projects/benchmarks.ts): for Theme and Preset Design & Development, the budget is the average working
 * days of the finished projects of that type; a project with no deadline set by hand is due its first report + the budget in working
 * days, and `extraDays` is what it has used beyond the budget.
 */
export async function loadDeadlines() {
  await connectToDatabase();
  const [projects, themes, latest] = await Promise.all([
    Project.find({ type: { $ne: "theme_update" } }).select("themeId name portal type status deadline designDays developmentDays").lean(),
    Theme.find().select("name").lean(),
    ChatReport.aggregate<{ _id: { kind: string; key: unknown }; date: Date; first: Date }>([
      { $match: { status: "ok", kind: { $in: ["theme", "preset"] } } },
      { $group: { _id: { kind: "$kind", key: { $cond: [{ $eq: ["$kind", "theme"] }, "$themeId", "$projectId"] } }, date: { $max: "$date" }, first: { $min: "$date" } } },
    ]),
  ]);
  const themeName = new Map(themes.map((t) => [String(t._id), t.name as string]));
  const lastReport = new Map(latest.filter((l) => l._id.key).map((l) => [`${l._id.kind}:${String(l._id.key)}`, dayKey(l.date)]));
  const firstReport = new Map(latest.filter((l) => l._id.key).map((l) => [`${l._id.kind}:${String(l._id.key)}`, dayKey(l.first)]));
  const today = todayInIst();

  // The benchmark per type, from the finished projects' total days (hours of everyone but managers / 8.5).
  const totals = await loadProjectTotals(projects);
  const usedDaysOf = (id: unknown) => daysFromHours(totals.get(String(id))?.totalHours ?? 0);
  const benchmarks = {} as Record<BenchmarkType, Benchmark | null>;
  for (const type of BENCHMARK_TYPES) {
    benchmarks[type] = averageDays(
      projects.filter((p) => (p.type ?? "theme_development") === type && FINISHED_STATUSES.includes(p.status)).map((p) => usedDaysOf(p._id))
    );
  }

  const rows = projects.map((p) => {
    const type = p.type ?? "theme_development";
    const lastReportOn = (type === "preset_development" ? lastReport.get(`preset:${String(p._id)}`) : lastReport.get(`theme:${String(p.themeId)}`)) ?? null;
    const status = (p.status ?? null) as ProjectStatus | null;
    const startedOn = (type === "preset_development" ? firstReport.get(`preset:${String(p._id)}`) : firstReport.get(`theme:${String(p.themeId)}`)) ?? null;
    const benchmark = type === "theme_development" || type === "preset_development" ? benchmarks[type as BenchmarkType] : null;
    const usedDays = usedDaysOf(p._id);
    const averageDeadline = benchmark && startedOn ? addWorkingDays(startedOn, benchmark.days) : null;
    const handDeadline = p.deadline ? dayKey(p.deadline) : null;
    const effectiveDeadline = handDeadline ?? averageDeadline;
    return {
      _id: String(p._id),
      name: p.name as string,
      themeName: themeName.get(String(p.themeId)) ?? null,
      portal: p.portal ?? null,
      type,
      status,
      deadline: handDeadline,
      lastReportOn,
      startedOn,
      // Budget = the average days of finished projects of this type (null for a Theme Update, or when none has finished with hours).
      budgetDays: benchmark?.days ?? null,
      budgetSample: benchmark?.sample ?? null,
      usedDays,
      extraDays: extraDays(usedDays, benchmark?.days ?? null),
      averageDeadline,
      deadlineBasis: handDeadline ? "set" : averageDeadline ? "average" : null,
      ...deadlineInfo({ status, deadline: effectiveDeadline, lastReportOn, today }),
    };
  });

  return { today, benchmarks, projects: rows };
}
