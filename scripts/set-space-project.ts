import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceProject } from "@/models/service-project";
import { ServiceProjectSpace } from "@/models/service-project-space";

// Connects ONE Chat space to a Service project, so it shows inside that project's tab in Live Project Chat Summary (owner, 2026-11-26: "Lulu
// Designs goes inside Stacy King"). The project is found by its exact name and must be exactly one. The space needs no reviewed list yet.
// Several spaces can sit under one project. Dry run unless --apply; the owner runs --apply. Audit: project_space.link. --unlink removes it.
// To link all the name matches at once, use link-matched-spaces.ts.
//
//   npx tsx --env-file=.env.production.local scripts/set-space-project.ts --space=spaces/AAQAYekyB1Y --project="Stacy King" [--name="Space name"] [--apply]
//   npx tsx --env-file=.env.production.local scripts/set-space-project.ts --space=spaces/AAQAYekyB1Y --unlink [--apply]
const apply = process.argv.includes("--apply");
const unlink = process.argv.includes("--unlink");
const arg = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();

async function main() {
  const space = arg("space");
  const projectName = arg("project");
  if (!space?.startsWith("spaces/") || (!unlink && !projectName)) {
    throw new Error('Usage: set-space-project.ts --space=spaces/XXXX --project="Exact project name" [--name="Space name"] [--apply]  (or --unlink)');
  }
  await connectToDatabase();
  const existing = await ServiceProjectSpace.findById(space).lean();

  if (unlink) {
    if (!existing) throw new Error(`${space} is not connected to any project. Nothing changed.`);
    console.log(`${apply ? "APPLYING" : "Dry run"}: ${space} (${existing.displayName ?? "no name"}) disconnected.`);
    if (!apply) return console.log("Nothing written. Add --apply to save.");
    await ServiceProjectSpace.deleteOne({ _id: space });
    await recordServiceAudit("project_space.link", { space, projectId: null });
    return console.log("Done.");
  }

  const projects = await ServiceProject.find({ name: projectName }).select("name status").lean<Array<{ _id: string; name: string; status: string }>>();
  if (projects.length !== 1) throw new Error(`Expected exactly one project named "${projectName}", found ${projects.length}. Nothing changed.`);
  const p = projects[0];
  const displayName = arg("name") ?? existing?.displayName ?? null;
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: ${space}${displayName ? ` (${displayName})` : ""} -> project "${p.name}" (${p.status}), was ${existing ? existing.projectId : "not connected"}.`
  );
  if (!apply) return console.log("Nothing written. Add --apply to save.");
  await ServiceProjectSpace.updateOne({ _id: space }, { $set: { projectId: p._id, displayName } }, { upsert: true });
  await recordServiceAudit("project_space.link", { space, projectId: p._id, project: p.name });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
