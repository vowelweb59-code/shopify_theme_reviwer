import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { classifyHistorical } from "@/lib/chat/historicalClassification";
import { parseReport } from "@/lib/chat/parseReport";
import { resolveMember } from "@/lib/chat/resolve";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { Theme } from "@/models/theme";
import { TimeEntry } from "@/models/time-entry";

// ONE-TIME: sorts the time reports already imported from Google Chat into new development (theme / preset) and updates,
// by the monthly development lists in lib/chat/developmentSchedule.ts, then locks them so a re-check or a sync never
// changes them. Update work becomes hours on the theme's "<Theme> Update" project, with the poster added to its team.
// Only reports that are not locked yet are touched (anything already classified, or moved by hand, stays as it is), so it can be re-run for newly imported ones.
// Reports that can't be placed (unknown theme or poster, no Update project) are left unlocked and flagged, to fix and re-run.
// A dry run by default; --apply writes, after saving the affected reports and hours to backups/.
//   npx tsx --env-file=.env.production.local scripts/classify-existing-reports.ts          (dry run, live)
//   npx tsx --env-file=.env.production.local scripts/classify-existing-reports.ts --apply  (writes to live)
const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const [themes, members, updateProjects, reports] = await Promise.all([
    Theme.find().select("name themeStorePresets demoStorePresets").lean(),
    TeamMember.find().select("name aliases updatesAndPresetsOnly").lean(),
    Project.find({ type: "theme_update" }).select("themeId members").lean(),
    ChatReport.find({ locked: { $ne: true } }).lean(),
  ]);
  const themeRefs = themes.map((t) => ({
    id: String(t._id),
    name: t.name as string,
    presets: [...new Set([...(t.themeStorePresets ?? []).map((p: { name: string }) => p.name), ...(t.demoStorePresets ?? []).map((p: { label: string }) => p.label)])],
  }));
  const memberRefs = members.map((m) => ({ id: String(m._id), name: m.name as string, aliases: (m.aliases ?? []) as string[] }));
  const updatesOnly = new Set(members.filter((m) => m.updatesAndPresetsOnly).map((m) => String(m._id)));
  const updateByTheme = new Map<string, { _id: unknown; memberIds: Set<string> }[]>();
  for (const p of updateProjects) {
    const list = updateByTheme.get(String(p.themeId)) ?? [];
    list.push({ _id: p._id, memberIds: new Set(p.members.map((m: { memberId: unknown }) => String(m.memberId))) });
    updateByTheme.set(String(p.themeId), list);
  }

  const operations: Record<string, unknown>[] = [];
  const entries: Record<string, unknown>[] = [];
  const teamAdds = new Map<string, { projectId: unknown; memberId: string }>();
  const counts = new Map<string, number>();
  const flagged: string[] = [];
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

  for (const r of reports) {
    const where = `${r.date.toISOString().slice(0, 10)} | ${r.sender || "?"} | ${r.rawText.split("\n").find((l: string) => /theme\s*name/i.test(l))?.trim() ?? r.themeName}`;
    const parsed = parseReport(r.rawText);
    if (!parsed.ok) {
      flagged.push(`${where} -> ${parsed.error}`);
      continue;
    }
    const memberId = r.memberId ? String(r.memberId) : r.sender ? resolveMember(r.sender, memberRefs) : null;
    const result = classifyHistorical(parsed.value, themeRefs, { updatesAndPresetsOnly: memberId !== null && updatesOnly.has(memberId) });
    const reasons: string[] = [];
    if (!result.ok) reasons.push(result.reason);
    if (!memberId) reasons.push(`Could not match "${r.sender || "the poster"}" to a team member.`);

    let projectId: unknown = null;
    if (result.ok && result.kind === "update") {
      const projects = updateByTheme.get(result.themeId) ?? [];
      if (projects.length !== 1) reasons.push(projects.length === 0 ? `${result.themeName} has no Theme Update project.` : `${result.themeName} has more than one Theme Update project.`);
      else if (memberId) {
        projectId = projects[0]._id;
        if (!projects[0].memberIds.has(memberId)) teamAdds.set(`${String(projects[0]._id)}:${memberId}`, { projectId: projects[0]._id, memberId });
      }
    }

    if (reasons.length > 0) {
      flagged.push(`${where} -> ${reasons.join(" ")}`);
      bump("flagged");
      operations.push({ updateOne: { filter: { _id: r._id }, update: { $set: { memberId, status: "needs_review", reason: reasons.join(" "), locked: false } } } });
      continue;
    }
    if (!result.ok) continue;
    bump(`${parsed.value.date.slice(0, 7)} ${result.kind}`);
    operations.push({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { memberId, themeId: result.themeId, kind: result.kind, preset: result.preset, projectId, status: "ok", reason: null, locked: true } },
      },
    });
    if (projectId && memberId) {
      entries.push({ projectId, memberId, date: r.date, hours: Math.round((r.minutes / 60) * 100) / 100, note: r.memo ?? "", chatReportKey: r.key });
    }
  }

  console.log("Result by month and kind:");
  for (const [k, n] of [...counts].sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log(`\nUpdate hours entries to write: ${entries.length}; people added to Update-project teams: ${teamAdds.size}`);
  console.log(`\nStill flagged (${flagged.length}):`);
  for (const f of flagged) console.log(`  ! ${f}`);

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to write.");
    return;
  }

  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `chat-reports-before-classify-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const oldEntries = await TimeEntry.find({ chatReportKey: { $in: reports.map((r) => r.key) } }).lean();
  writeFileSync(file, JSON.stringify({ reports, entries: oldEntries }, null, 2));
  console.log(`\nSaved the current reports and chat hours to ${file}`);

  if (operations.length > 0) await ChatReport.bulkWrite(operations as never, { ordered: false });
  if (teamAdds.size > 0) {
    await Project.bulkWrite(
      [...teamAdds.values()].map((a) => ({
        updateOne: { filter: { _id: a.projectId, "members.memberId": { $ne: a.memberId } }, update: { $push: { members: { memberId: a.memberId, role: null } } } },
      })) as never,
      { ordered: false }
    );
  }
  // Hours made from chat reports come only from reports, so they are rebuilt from this classification.
  await TimeEntry.deleteMany({ chatReportKey: { $in: reports.map((r) => r.key) } });
  if (entries.length > 0) await TimeEntry.insertMany(entries, { ordered: false });
  console.log(`Done: updated ${operations.length} reports, wrote ${entries.length} hours entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
