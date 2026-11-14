/**
 * Read-only: shows why a theme's project has (or hasn't) hours. For a theme name it lists the Theme rows with that name, their
 * projects, and every stored Theme Status Group report that mentions the name (by theme, by name or by text), with the status,
 * reason, matched member and designation: the things that decide whether a report counts (lib/projects/loadTotals.ts).
 *
 *   npx tsx --env-file=.env.production.local scripts/diagnose-theme-reports.ts Velocity [--limit=200]
 * Each report is shown with its own Theme Name line, its kind, preset and whether it is linked to a project.
 */
import { connectToDatabase } from "../lib/db/connect";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { TeamMember } from "../models/team-member";
import { Theme } from "../models/theme";

const name = process.argv.slice(2).find((a) => !a.startsWith("--"));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main() {
  if (!name) throw new Error("Usage: diagnose-theme-reports.ts <theme name>");
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const re = new RegExp(esc(name), "i");
  const themes = await Theme.find({ name: re }).select("name themeStoreLive").lean<{ _id: unknown; name: string; themeStoreLive?: boolean | null }[]>();
  console.log(`Theme rows matching "${name}": ${themes.length}`);
  for (const t of themes) {
    console.log(`  ${t._id}  ${t.name}  live=${t.themeStoreLive}`);
    const projects = await Project.find({ themeId: t._id }).select("name type status designDays developmentDays").lean<{ _id: unknown; name: string; type?: string; status?: string; designDays: number | null; developmentDays: number | null }[]>();
    for (const p of projects) console.log(`     project "${p.name}" ${p.type ?? "theme_development"} ${p.status ?? ""} fixed design=${p.designDays} development=${p.developmentDays}`);
  }
  const themeIds = themes.map((t) => t._id);
  const reports = await ChatReport.find({ $or: [{ themeName: re }, { themeId: { $in: themeIds } }, { rawText: re }] })
    .sort({ date: -1 })
    .lean<{ date: Date; sender: string; memberId: unknown; themeName: string; themeId: unknown; kind: string | null; preset: string | null; status: string; reason: string | null; minutes: number; projectId: unknown; rawText: string }[]>();
  console.log(`\nReports mentioning "${name}": ${reports.length}`);
  const members = new Map((await TeamMember.find().select("name designation").lean<{ _id: unknown; name: string; designation: string }[]>()).map((m) => [String(m._id), m]));
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8)) || 40;
  for (const r of reports.slice(0, limit)) {
    const m = r.memberId ? members.get(String(r.memberId)) : null;
    console.log(`  ${new Date(r.date).toISOString().slice(0, 10)} ${r.sender || "?"} [${m ? `member ok, "${m.designation}"` : "NO MEMBER"}] line="${/theme\s*name\s*[:\-–—]*\s*(.+)/i.exec(r.rawText)?.[1]?.trim() ?? r.themeName}" kind=${r.kind}${r.preset ? ` preset=${r.preset}` : ""}${r.projectId ? " linked" : ""} status=${r.status} ${r.minutes}min${r.reason ? ` reason: ${r.reason}` : ""}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
