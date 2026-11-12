/**
 * Moves Aspire's Chat time reports to Rare (owner decision 2026-11-12): all Aspire reports become Rare reports, and each Aspire
 * preset becomes a Rare preset (Beauty -> Touch, Wellness -> Synergy, Clothing -> Charisma, Arts -> Presence; the map is
 * MERGED_THEMES in lib/chat/resolve.ts, which also makes later reports naming Aspire land on Rare).
 *
 *   npx tsx --env-file=.env.production.local scripts/merge-aspire-into-rare.ts           # dry run: prints the plan
 *   npx tsx --env-file=.env.production.local scripts/merge-aspire-into-rare.ts --apply   # writes (owner runs it; take a backup first)
 *
 * What it does with each Aspire report (ChatReport with themeId = Aspire):
 *  - theme work: moves to the Rare theme (its hours count on the "Rare" project);
 *  - preset work with a known Aspire preset: renamed to the Rare preset and linked to the "Rare <Preset>" project;
 *  - "Theme Update": becomes update work, linked to "Rare Update" with an hours entry for the poster (as a Chat import does);
 *  - preset work with no preset named, or an unknown one (Collective): moves to Rare but stays unlinked, left for review.
 * Missing Rare projects are created first: "Rare" (Theme Design & Development), "Rare Touch" / "Rare Charisma" / "Rare Synergy" /
 * "Rare Presence" (Preset Development), and "Rare Update" (Theme Update only if a report needs it), portal Themeshopy, status Live.
 * The Aspire theme row stays (hidden); the old values of every changed report are saved in one admin_audit_log entry
 * (action reports.merge_theme, detail.before) so the move can be undone. Safe to re-run: reports already moved are not Aspire's.
 */
import { connectToDatabase } from "../lib/db/connect";
import { MERGED_THEMES, mergedPresetName } from "../lib/chat/resolve";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";
import { TimeEntry } from "../models/time-entry";

const apply = process.argv.includes("--apply");
const PORTAL = "Themeshopy";
const lower = (s: string) => s.trim().toLowerCase();

type Report = {
  _id: unknown;
  key: string;
  memberId: unknown;
  date: Date;
  themeName: string;
  kind: string | null;
  preset: string | null;
  projectId: unknown;
  minutes: number;
  memo: string;
  status: string;
};

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const merge = MERGED_THEMES.aspire;
  const aspire = await Theme.findOne({ name: "Aspire" }).select("_id").lean<{ _id: unknown }>();
  const rare = await Theme.findOne({ name: merge.into }).select("_id name").lean<{ _id: unknown; name: string }>();
  if (!aspire) throw new Error('Theme "Aspire" not found.');
  if (!rare) throw new Error(`Theme "${merge.into}" not found. Add it first: npm run theme:add -- "${merge.into}" --apply`);

  const reports = await ChatReport.find({ themeId: aspire._id }).lean<Report[]>();
  console.log(`${reports.length} Aspire report(s), ${(reports.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)} h.\n`);
  if (reports.length === 0) return;

  const presetOf = (r: Report) => (r.preset ? mergedPresetName(merge, r.preset) : undefined);
  const isUpdate = (r: Report) => r.preset !== null && lower(r.preset) === "theme update";
  const needsUpdateProject = reports.some(isUpdate);

  // Rare's projects: found by name, created when missing.
  const wanted = [
    { name: rare.name, type: "theme_development", status: "live" as string | null },
    ...[...new Set(Object.values(merge.presets))].map((p) => ({ name: `${rare.name} ${p}`, type: "preset_development", status: "live" as string | null })),
    ...(needsUpdateProject ? [{ name: `${rare.name} Update`, type: "theme_update", status: null as string | null }] : []),
  ];
  const projectIds = new Map<string, unknown>();
  for (const w of wanted) {
    const existing = await Project.findOne({ themeId: rare._id, name: w.name }).select("_id").lean<{ _id: unknown }>();
    if (existing) {
      projectIds.set(w.name, existing._id);
      console.log(`Project "${w.name}": exists.`);
    } else if (apply) {
      const created = await Project.create({ themeId: rare._id, name: w.name, type: w.type, status: w.status, portal: PORTAL });
      projectIds.set(w.name, created._id);
      console.log(`Project "${w.name}": created (${w.type}, ${w.status ?? "no status"}, ${PORTAL}).`);
    } else {
      projectIds.set(w.name, `(new ${w.name})`);
      console.log(`Project "${w.name}": would create (${w.type}, ${w.status ?? "no status"}, ${PORTAL}).`);
    }
  }

  const before: Record<string, unknown>[] = [];
  const ops: Parameters<typeof ChatReport.bulkWrite>[0] = [];
  const entries: Record<string, unknown>[] = [];
  const tally = new Map<string, { n: number; minutes: number }>();
  const count = (label: string, r: Report) => {
    const t = tally.get(label) ?? { n: 0, minutes: 0 };
    t.n++;
    t.minutes += r.minutes;
    tally.set(label, t);
  };

  for (const r of reports) {
    const set: Record<string, unknown> = { themeId: rare._id, themeName: rare.name };
    const mapped = presetOf(r);
    if (isUpdate(r)) {
      const projectId = projectIds.get(`${rare.name} Update`);
      Object.assign(set, { kind: "update", preset: null, projectId });
      if (r.memberId && r.status === "ok" && r.minutes > 0) {
        entries.push({ projectId, memberId: r.memberId, date: r.date, hours: Math.max(0.01, Math.round((r.minutes / 60) * 100) / 100), note: r.memo, chatReportKey: r.key });
      }
      count(`Theme Update -> ${rare.name} Update`, r);
    } else if (mapped) {
      Object.assign(set, { kind: "preset", preset: mapped, projectId: projectIds.get(`${rare.name} ${mapped}`) });
      count(`${r.preset} -> ${rare.name} ${mapped}`, r);
    } else if (r.kind === "theme") {
      Object.assign(set, { projectId: null });
      count(`theme work -> ${rare.name}`, r);
    } else {
      Object.assign(set, { projectId: null });
      count(`left for review (preset ${r.preset ?? "not named"}) -> ${rare.name}, unlinked`, r);
    }
    before.push({ key: r.key, themeId: String(aspire._id), themeName: r.themeName, kind: r.kind, preset: r.preset, projectId: r.projectId ? String(r.projectId) : null });
    ops.push({ updateOne: { filter: { _id: r._id as never }, update: { $set: set } } });
  }

  console.log("");
  for (const [label, t] of [...tally.entries()].sort()) console.log(`  ${String(t.n).padStart(3)} report(s), ${(t.minutes / 60).toFixed(1).padStart(6)} h: ${label}`);
  console.log(`\n${entries.length} Theme Update hours entr${entries.length === 1 ? "y" : "ies"} to log.`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to move the reports (take a database backup first).");
    return;
  }

  await ChatReport.bulkWrite(ops);
  let logged = 0;
  const teamAdded = new Set<string>();
  for (const e of entries) {
    if (await TimeEntry.exists({ chatReportKey: e.chatReportKey })) continue;
    await TimeEntry.create(e);
    logged++;
    const key = `${String(e.projectId)}:${String(e.memberId)}`;
    if (!teamAdded.has(key)) {
      teamAdded.add(key);
      await Project.updateOne({ _id: e.projectId, "members.memberId": { $ne: e.memberId } }, { $push: { members: { memberId: e.memberId, role: null } } });
    }
  }
  await AdminAudit.create({ action: "reports.merge_theme", detail: { from: "Aspire", to: rare.name, moved: reports.length, timeEntries: logged, before } });
  console.log(`\nMoved ${reports.length} report(s) to ${rare.name}; logged ${logged} Theme Update hours entr${logged === 1 ? "y" : "ies"}. Old values saved in admin_audit_log (reports.merge_theme).`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
