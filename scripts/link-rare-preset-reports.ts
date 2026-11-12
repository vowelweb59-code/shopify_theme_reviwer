/**
 * Links Rare's preset reports that the Aspire merge left unlinked (kind preset, no project) to their "Rare <Preset>" project.
 * The preset is read from each report's own Theme Name line: Beauty -> Touch, Wellness -> Synergy, Arts/Art -> Presence,
 * Collective -> Charisma (owner, 2026-11-12), Clothing -> Charisma. A report whose line names none of them is left alone and listed.
 *
 *   npx tsx --env-file=.env.production.local scripts/link-rare-preset-reports.ts           # dry run: lists each report and its target
 *   npx tsx --env-file=.env.production.local scripts/link-rare-preset-reports.ts --apply   # writes (owner runs it)
 *
 * The old values are saved in one admin_audit_log entry (reports.link_preset, detail.before). Safe to re-run: linked reports are skipped.
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");

// First match wins; tested against the report's Theme Name line only (never the memo).
const PRESET_BY_TEXT: { re: RegExp; preset: string }[] = [
  { re: /\bcollective\b/i, preset: "Charisma" },
  { re: /\bbeauty\b/i, preset: "Touch" },
  { re: /\bwellness\b/i, preset: "Synergy" },
  { re: /\barts?\b/i, preset: "Presence" },
  { re: /\bclothing\b/i, preset: "Charisma" },
];

/** The Theme Name line of a report's original text: what sits between "Theme Name" and "Memo". */
function themeLine(raw: string): string {
  const m = /theme\s*name\s*[:\-]*\s*([\s\S]*?)\s*memo\s*[:\-]/i.exec(raw);
  return (m ? m[1] : "").replace(/\s+/g, " ").trim();
}

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const rare = await Theme.findOne({ name: "Rare" }).select("_id name").lean<{ _id: unknown; name: string }>();
  if (!rare) throw new Error('Theme "Rare" not found.');
  const projects = await Project.find({ themeId: rare._id, type: "preset_development" }).select("name").lean<{ _id: unknown; name: string }[]>();
  const projectByName = new Map(projects.map((p) => [p.name, p._id]));

  const reports = await ChatReport.find({ themeId: rare._id, kind: "preset", projectId: null }).sort({ date: 1 }).lean<
    { _id: unknown; key: string; date: Date; sender: string; minutes: number; preset: string | null; rawText: string }[]
  >();
  console.log(`${reports.length} unlinked Rare preset report(s).\n`);

  const before: Record<string, unknown>[] = [];
  const ops: Parameters<typeof ChatReport.bulkWrite>[0] = [];
  const left: string[] = [];
  const tally = new Map<string, { n: number; minutes: number }>();

  for (const r of reports) {
    const line = themeLine(r.rawText);
    const hit = PRESET_BY_TEXT.find((p) => p.re.test(line));
    const projectId = hit ? projectByName.get(`${rare.name} ${hit.preset}`) : undefined;
    const label = `${r.date.toISOString().slice(0, 10)} ${r.sender} ${(r.minutes / 60).toFixed(1)}h "${line}"`;
    if (!hit || !projectId) {
      left.push(label);
      continue;
    }
    console.log(`  ${label} -> ${rare.name} ${hit.preset}`);
    const t = tally.get(hit.preset) ?? { n: 0, minutes: 0 };
    t.n++;
    t.minutes += r.minutes;
    tally.set(hit.preset, t);
    before.push({ key: r.key, preset: r.preset, projectId: null });
    ops.push({ updateOne: { filter: { _id: r._id as never }, update: { $set: { preset: hit.preset, projectId } } } });
  }

  console.log("");
  for (const [preset, t] of [...tally.entries()].sort()) console.log(`${String(t.n).padStart(3)} report(s), ${(t.minutes / 60).toFixed(1).padStart(5)} h -> ${rare.name} ${preset}`);
  if (left.length > 0) {
    console.log(`\n${left.length} report(s) left alone (no known preset in the Theme Name line, or no project for it):`);
    left.forEach((l) => console.log(`  ${l}`));
  }

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to link them.");
    return;
  }
  if (ops.length > 0) {
    await ChatReport.bulkWrite(ops);
    await AdminAudit.create({ action: "reports.link_preset", detail: { theme: rare.name, linked: ops.length, before } });
  }
  console.log(`\nLinked ${ops.length} report(s). Old values saved in admin_audit_log (reports.link_preset).`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
