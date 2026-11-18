import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Owner, 2026-11-18: "move all the direct projects to fixed projects". Every project on the Upwork profile "Direct" gets contract type
// FIXED (so it shows under the Fixed tab). Only the type changes: any hourly rate, weekly hours or price already entered stays. A fixed
// project that also has an hourly rate is billed by the hours; one with a price is capped at price / $15; one with neither shows
// "no price" until it is entered in the project's contract editor. Dry run unless --apply (the owner runs it); audit `projects.set_direct_fixed`.
//   npx tsx --env-file=.env.production.local scripts/set-direct-projects-fixed.ts [--apply]
const apply = process.argv.includes("--apply");

async function main() {
  await connectToDatabase();
  const direct = await ServiceUpworkProfile.findOne({ name: "Direct" }).select("_id").lean<{ _id: string } | null>();
  if (!direct) throw new Error('No Upwork profile named "Direct".');
  const projects = await ServiceProject.find({ upworkProfileId: direct._id }).select("name status contract").lean<
    Array<{ _id: string; name: string; status: string; contract: { type: string; fixedPriceCents: number | null; hourlyRateCents: number | null } | null }>
  >();
  const todo = projects.filter((p) => p.contract && p.contract.type !== "FIXED");
  const noContract = projects.filter((p) => !p.contract);
  console.log(`${apply ? "APPLYING" : "Dry run"}: ${projects.length} projects are on the profile Direct; ${projects.length - todo.length - noContract.length} are already Fixed; ${todo.length} would change from ${[...new Set(todo.map((p) => p.contract!.type))].join("/") || "-"} to FIXED.`);
  const by = new Map<string, number>();
  for (const p of todo) by.set(p.status, (by.get(p.status) ?? 0) + 1);
  console.log(`By status: ${[...by].map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
  const withRate = todo.filter((p) => p.contract!.hourlyRateCents != null).length;
  console.log(`${withRate} of them have an hourly rate (billed by the hours once Fixed); ${todo.length - withRate} have no rate and no price (shown "no price").`);
  if (noContract.length) console.log(`${noContract.length} Direct projects have no contract and are left alone: ${noContract.map((p) => p.name).join(", ")}`);
  for (const p of todo) console.log(`  ${p.name} [${p.status}]`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");

  const r = await ServiceProject.updateMany({ _id: { $in: todo.map((p) => p._id) }, "contract.type": { $ne: "FIXED" } }, { $set: { "contract.type": "FIXED" } });
  await recordServiceAudit("projects.set_direct_fixed", { changed: r.modifiedCount, via: "scripts/set-direct-projects-fixed.ts" });
  console.log(`Done: ${r.modifiedCount} projects set to Fixed.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
