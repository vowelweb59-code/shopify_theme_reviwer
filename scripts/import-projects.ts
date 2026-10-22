import { readFileSync } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/lib/db/connect";
import { buildPlan, type ImportData } from "@/lib/projects/importPlan";
import { Theme } from "@/models/theme";
import { TeamMember } from "@/models/team-member";
import { Project } from "@/models/project";

// Imports data/project-import.json as projects (see lib/projects/importPlan.ts
// for the rules). A dry run by default: prints what it would create and change
// and writes nothing. Pass --apply to write. Safe to re-run — it matches by
// name and only fills gaps. The database is whichever MONGODB_URI the env file
// you pass points at, e.g.:
//   npx tsx --env-file=.env.production.local scripts/import-projects.ts          (dry run, live)
//   npx tsx --env-file=.env.production.local scripts/import-projects.ts --apply  (writes to live)
//   npm run import:projects                                                       (dry run, .env.local)
const apply = process.argv.includes("--apply");

async function main() {
  const data = JSON.parse(readFileSync(path.join(process.cwd(), "data", "project-import.json"), "utf8")) as ImportData;
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const [themes, members, projects] = await Promise.all([Theme.find().select("name").lean(), TeamMember.find().select("name").lean(), Project.find().lean()]);
  const themeById = new Map(themes.map((t) => [String(t._id), t.name as string]));
  const memberById = new Map(members.map((m) => [String(m._id), m.name as string]));

  const plan = buildPlan(data, {
    themes: themes.map((t) => t.name),
    members: members.map((m) => m.name),
    projects: projects.map((p) => ({
      name: p.name,
      portal: p.portal ?? null,
      themeName: themeById.get(String(p.themeId)) ?? null,
      status: p.status ?? null,
      designDays: p.designDays ?? null,
      developmentDays: p.developmentDays ?? null,
      description: p.description ?? "",
      roundCount: (p.rounds ?? []).length,
      memberNames: p.members.map((x: { memberId: unknown }) => memberById.get(String(x.memberId)) ?? "").filter(Boolean),
    })),
  });

  console.log(`New themes (no ZIP): ${plan.newThemes.join(", ") || "none"}`);
  console.log(`New team members: ${plan.newMembers.map((m) => `${m.name} (${m.designation})`).join(", ") || "none"}\n`);
  console.log(`Projects to create (${plan.creates.length}):`);
  for (const c of plan.creates) {
    console.log(`  + ${c.name} [${c.themeName}] ${c.status} design=${c.designDays ?? "-"}d dev=${c.developmentDays ?? "-"}d | ${c.memberNames.join(", ") || "(no team)"}${c.rounds.length ? ` | ${c.rounds.length} earlier round(s)` : ""}`);
  }
  console.log(`\nExisting projects to update (${plan.updates.length}):`);
  for (const u of plan.updates) {
    console.log(`  ~ ${u.name}: set ${JSON.stringify(u.set)}; add ${u.addMembers.join(", ") || "nobody"}${u.notes.length ? ` | ${u.notes.join("; ")}` : ""}`);
  }
  console.log(`\nSkipped (${plan.skipped.length}):`);
  for (const s of plan.skipped) console.log(`  - ${s}`);
  console.log(`\nTo check (${plan.conflicts.length}):`);
  for (const c of plan.conflicts) console.log(`  ! ${c}`);

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to write.");
    return;
  }

  // Resolve ids, creating what's missing first, so a bad name fails before any project is written.
  const themeIds = new Map(themes.map((t) => [String(t.name).toLowerCase(), t._id]));
  const memberIds = new Map(members.map((m) => [String(m.name).toLowerCase(), m._id]));
  for (const name of plan.newThemes) themeIds.set(name.toLowerCase(), (await Theme.create({ name }))._id);
  for (const m of plan.newMembers) memberIds.set(m.name.toLowerCase(), (await TeamMember.create(m))._id);

  const memberRefs = (names: string[]) =>
    names.map((n) => {
      const memberId = memberIds.get(n.toLowerCase());
      if (!memberId) throw new Error(`No team member named "${n}" — add them on the Team page, or fix data/project-import.json.`);
      return { memberId, role: null };
    });

  // Built up front: if a member name doesn't resolve, nothing below has run yet.
  const creates = plan.creates.map((c) => {
    const themeId = themeIds.get(c.themeName.toLowerCase());
    if (!themeId) throw new Error(`No theme named "${c.themeName}".`);
    return { themeId, name: c.name, portal: c.portal, description: c.description, type: "theme_development", status: c.status, designDays: c.designDays, developmentDays: c.developmentDays, members: memberRefs(c.memberNames), rounds: c.rounds.map((r) => ({ status: "rejected", designDays: null, developmentDays: null, note: "", members: memberRefs(r.memberNames) })) };
  });
  const updates = plan.updates.map((u) => ({ u, refs: memberRefs(u.addMembers) }));

  for (const doc of creates) await Project.create(doc);
  for (const { u, refs } of updates) {
    const existing = projects.find((p) => p.name.toLowerCase() === u.name.toLowerCase());
    if (!existing) continue;
    await Project.updateOne({ _id: existing._id }, { $set: u.set, ...(refs.length ? { $push: { members: { $each: refs } } } : {}) });
  }
  console.log(`\nDone: created ${creates.length} projects, updated ${updates.length}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
