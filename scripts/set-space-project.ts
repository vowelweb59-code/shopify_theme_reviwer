import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceProject } from "@/models/service-project";
import { ServiceSpaceReview } from "@/models/service-space-review";

// Connects a Chat space's reviewed list to a Service project, so it shows inside that project's tab in Live Project Chat Summary (owner,
// 2026-11-26: "Lulu Designs goes inside Stacy King"). The project is found by its exact name and must be exactly one; the space must already
// have a reviewed list (scripts/import-space-review.ts). Several spaces can sit under one project. Dry run unless --apply; the owner runs
// --apply. Audit: space_review.link.  Use --unlink to remove the connection.
//
//   npx tsx --env-file=.env.production.local scripts/set-space-project.ts --space=spaces/AAQAYekyB1Y --project="Stacy King" [--apply]
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
  if (!space || (!unlink && !projectName))
    throw new Error('Usage: set-space-project.ts --space=spaces/XXXX --project="Exact project name" [--apply]  (or --unlink)');
  await connectToDatabase();
  const review = await ServiceSpaceReview.findById(space).lean();
  if (!review) throw new Error(`No reviewed list is stored for ${space}. Load one first with import-space-review.ts.`);

  if (unlink) {
    console.log(`${apply ? "APPLYING" : "Dry run"}: ${space} (${review.client ?? "no client"}) disconnected from its project.`);
    if (!apply) return console.log("Nothing written. Add --apply to save.");
    await ServiceSpaceReview.updateOne({ _id: space }, { $set: { projectId: null } });
    await recordServiceAudit("space_review.link", { space, projectId: null });
    return console.log("Done.");
  }

  const projects = await ServiceProject.find({ name: projectName }).select("name status").lean<Array<{ _id: string; name: string; status: string }>>();
  if (projects.length !== 1) throw new Error(`Expected exactly one project named "${projectName}", found ${projects.length}. Nothing changed.`);
  const p = projects[0];
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: ${space} (${review.client ?? "no client"}) -> project "${p.name}" (${p.status}), was ${review.projectId ?? "not connected"}.`
  );
  if (!apply) return console.log("Nothing written. Add --apply to save.");
  await ServiceSpaceReview.updateOne({ _id: space }, { $set: { projectId: p._id } });
  await recordServiceAudit("space_review.link", { space, projectId: p._id, project: p.name });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
