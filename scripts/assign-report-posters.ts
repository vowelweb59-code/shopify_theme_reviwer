/**
 * Puts everyone who posted a report on a project onto that project's team (owner, 2026-11-13: "if a person posts a report in a
 * project we need to assign them on that project"). New reports already do this (lib/chat/importReports.ts); this fills it in for
 * the reports stored before. Rules, only for reports with status ok and a matched team member:
 *   - a new-theme report (kind "theme") joins the theme's Theme Design & Development project, when the theme has exactly one that is
 *     not Live (several would be a guess, so those are listed and skipped);
 *   - a preset report linked to a Preset Development project (projectId) joins that project.
 * Product Managers (designation contains "manager") are skipped: the owner adds them by hand. Theme Update projects are already handled at import. Nobody is added twice, existing members and roles are untouched.
 *
 *   npx tsx --env-file=.env.production.local scripts/assign-report-posters.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/assign-report-posters.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { TeamMember } from "../models/team-member";

const apply = process.argv.includes("--apply");

type P = { _id: unknown; name: string; themeId: unknown; type?: string | null; status?: string | null; members: { memberId: unknown }[] };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const projects = await Project.find({ type: { $in: ["theme_development", "preset_development", null] } }).select("name themeId type status members").lean<P[]>();
  const byId = new Map(projects.map((p) => [String(p._id), p]));
  const devByTheme = new Map<string, P[]>();
  for (const p of projects) {
    if (p.type === "preset_development" || p.status === "live") continue;
    devByTheme.set(String(p.themeId), [...(devByTheme.get(String(p.themeId)) ?? []), p]);
  }
  const people = await TeamMember.find().select("name designation").lean<{ _id: unknown; name: string; designation?: string }[]>();
  const names = new Map(people.map((m) => [String(m._id), m.name]));
  const managers = new Set(people.filter((m) => /manager/i.test(m.designation ?? "")).map((m) => String(m._id)));

  const reports = await ChatReport.find({ status: "ok", memberId: { $ne: null }, kind: { $in: ["theme", "preset"] } }).select("memberId themeId kind projectId themeName").lean<{ memberId: unknown; themeId: unknown; kind: string; projectId: unknown; themeName: string }[]>();
  const adds = new Map<string, { project: P; memberId: string }>();
  const ambiguous = new Set<string>();
  for (const r of reports) {
    let project: P | undefined;
    if (r.kind === "theme" && r.themeId) {
      const dev = devByTheme.get(String(r.themeId)) ?? [];
      if (dev.length === 1) project = dev[0];
      else if (dev.length > 1) ambiguous.add(`${r.themeName} (${dev.map((d) => d.name).join(", ")})`);
    } else if (r.kind === "preset" && r.projectId) {
      const linked = byId.get(String(r.projectId));
      if (linked?.type === "preset_development") project = linked;
    }
    if (!project) continue;
    const memberId = String(r.memberId);
    if (managers.has(memberId)) continue;
    if (project.members.some((m) => String(m.memberId) === memberId)) continue;
    adds.set(`${String(project._id)}:${memberId}`, { project, memberId });
  }

  const perProject = new Map<string, string[]>();
  for (const { project, memberId } of adds.values()) perProject.set(project.name, [...(perProject.get(project.name) ?? []), names.get(memberId) ?? memberId]);
  console.log(`${adds.size} assignment(s) across ${perProject.size} project(s):`);
  for (const [project, people] of [...perProject.entries()].sort()) console.log(`  ${project}: ${people.sort().join(", ")}`);
  if (ambiguous.size) console.log(`\nSkipped, the theme has several open development projects:\n  ${[...ambiguous].join("\n  ")}`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to assign them.");
    return;
  }
  for (const { project, memberId } of adds.values()) {
    await Project.updateOne({ _id: project._id, "members.memberId": { $ne: memberId } }, { $push: { members: { memberId, role: null } } });
  }
  await AdminAudit.create({ action: "projects.assign_report_posters", detail: { assignments: [...perProject.entries()].map(([project, people]) => ({ project, people })) } });
  console.log("\nDone.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
