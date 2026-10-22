import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { planMerge, type MergeInput } from "@/lib/projects/rounds";
import { Project } from "@/models/project";
import { TimeEntry } from "@/models/time-entry";

// Folds projects saved one per version ("Voltix 1", "Voltix 2", ...) into one
// project per theme + portal + project type: the latest version stays, earlier
// ones become its `rounds` (status, team, days, note), so rejections remain
// countable per team member. See lib/projects/rounds.ts for the rules.
// A dry run by default: prints what it would merge and writes nothing. With
// --apply it first saves the affected projects to backups/, then writes. The
// database is whichever MONGODB_URI the env file you pass points at, e.g.:
//   npx tsx --env-file=.env.production.local scripts/merge-project-rounds.ts          (dry run, live)
//   npx tsx --env-file=.env.production.local scripts/merge-project-rounds.ts --apply  (writes to live)
const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const projects = await Project.find().lean();
  const inputs: MergeInput[] = projects.map((p) => ({
    id: String(p._id),
    themeId: String(p.themeId),
    portal: p.portal ?? null,
    type: p.type ?? "theme_development",
    name: p.name,
    status: p.status ?? null,
    designDays: p.designDays ?? null,
    developmentDays: p.developmentDays ?? null,
    description: p.description ?? "",
    members: p.members.map((m: { memberId: unknown; role: string | null }) => ({ memberId: String(m.memberId), role: m.role ?? null })),
    createdAt: new Date(p.createdAt).getTime(),
  }));
  const byId = new Map(projects.map((p) => [String(p._id), p]));

  // A project that already has rounds is already merged; leave it out so re-running is a no-op.
  const plan = planMerge(inputs.filter((i) => ((byId.get(i.id)?.rounds as unknown[] | undefined) ?? []).length === 0));
  console.log(`Themes to merge (${plan.length}):`);
  for (const g of plan) {
    const old = g.removeIds.map((id) => byId.get(id)?.name).join(", ");
    console.log(`  ${g.name}: keeps "${byId.get(g.keepId)?.name}" (${byId.get(g.keepId)?.status}); ${g.rounds.length} earlier round(s) from ${old} [${g.rounds.map((r) => r.status).join(", ")}]`);
  }
  console.log(`\nProjects: ${projects.length} now -> ${projects.length - plan.reduce((n, g) => n + g.removeIds.length, 0)} after.`);

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to write.");
    return;
  }
  if (plan.length === 0) return;

  const affected = plan.flatMap((g) => [g.keepId, ...g.removeIds]).map((id) => byId.get(id));
  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `projects-before-merge-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(affected, null, 2));
  console.log(`\nSaved the affected projects to ${file}`);

  for (const g of plan) {
    await Project.updateOne({ _id: g.keepId }, { $set: { name: g.name, rounds: g.rounds } });
    await TimeEntry.updateMany({ projectId: { $in: g.removeIds } }, { $set: { projectId: g.keepId } });
    await Project.deleteMany({ _id: { $in: g.removeIds } });
  }
  console.log(`Done: merged ${plan.length} themes.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
