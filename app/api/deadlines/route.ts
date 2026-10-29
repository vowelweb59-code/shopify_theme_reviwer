import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { dayKey, todayInIst } from "@/lib/chat/teamActivity";
import { deadlineInfo } from "@/lib/projects/deadlines";
import type { ProjectStatus } from "@/lib/projects/constants";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";

/**
 * Every project that has a due date (all but Theme Update, which is continuous) with its deadline state.
 * A theme project's last report is the latest new-theme report on its theme; a preset project's, the latest
 * preset report linked to it (the same scoping as lib/projects/loadTotals.ts).
 */
export async function GET() {
  await connectToDatabase();
  const [projects, themes, latest] = await Promise.all([
    Project.find({ type: { $ne: "theme_update" } }).select("themeId name portal type status deadline").lean(),
    Theme.find().select("name").lean(),
    ChatReport.aggregate<{ _id: { kind: string; key: unknown }; date: Date }>([
      { $match: { status: "ok", kind: { $in: ["theme", "preset"] } } },
      { $group: { _id: { kind: "$kind", key: { $cond: [{ $eq: ["$kind", "theme"] }, "$themeId", "$projectId"] } }, date: { $max: "$date" } } },
    ]),
  ]);
  const themeName = new Map(themes.map((t) => [String(t._id), t.name as string]));
  const lastReport = new Map(latest.filter((l) => l._id.key).map((l) => [`${l._id.kind}:${String(l._id.key)}`, dayKey(l.date)]));
  const today = todayInIst();

  const rows = projects.map((p) => {
    const type = p.type ?? "theme_development";
    const lastReportOn = (type === "preset_development" ? lastReport.get(`preset:${String(p._id)}`) : lastReport.get(`theme:${String(p.themeId)}`)) ?? null;
    const status = (p.status ?? null) as ProjectStatus | null;
    return {
      _id: String(p._id),
      name: p.name as string,
      themeName: themeName.get(String(p.themeId)) ?? null,
      portal: p.portal ?? null,
      type,
      status,
      deadline: p.deadline ? dayKey(p.deadline) : null,
      lastReportOn,
      ...deadlineInfo({ status, deadline: p.deadline ? dayKey(p.deadline) : null, lastReportOn, today }),
    };
  });

  return NextResponse.json({ today, projects: rows });
}
