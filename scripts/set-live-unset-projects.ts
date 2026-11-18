import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";

// Owner, 2026-11-18, for the live projects that had no rate, weekly hours or price ("Not set"). Dry run unless --apply (the owner runs
// it); audit `projects.set_live_unset`. Nothing here touches hours.
//   - "Yvette D": hourly at $15 (owner).
//   - "Touria Mohaiti", "Arsalan Lakhani", "Asadullah Grp", "Luisa Rivera": fixed projects that work like Richard Mintz (owner: "these worked
//     as Richard Mintz"): type FIXED with an hourly rate of $15, so they are billed by the hours worked (no price, no workable-hours cap).
//   - "Robert": the client is Robert Lewis (owner), Shraddha profile, $15/h, 15 hours a week (the "Projects On Timer" sheet). The project
//     and its client are renamed "Robert Lewis" (no alias "Robert": the importer matches a client name written whole inside the field,
//     so it would keep pulling "Robert Reckley" and "S Robert" in; see scripts/fix-robert-lewis.ts).
const apply = process.argv.includes("--apply");
const HOURLY_15 = ["Yvette D"];
const FIXED_TYPE = ["Touria Mohaiti", "Arsalan Lakhani", "Asadullah Grp", "Luisa Rivera"];

async function main() {
  await connectToDatabase();
  console.log(apply ? "APPLYING:" : "Dry run:");
  const one = async (name: string) => {
    const f = await ServiceProject.find({ name }).select("name status clientId contract").lean<Array<{ _id: string; name: string; status: string; clientId: string | null; contract: { type: string; hourlyRateCents: number | null; weeklyLimitMinutes: number | null; fixedPriceCents: number | null } | null }>>();
    if (f.length !== 1) { console.log(`  ${name}: ${f.length} projects match; skipped`); return null; }
    if (!f[0]!.contract) { console.log(`  ${name}: has no contract; skipped`); return null; }
    return f[0]!;
  };
  const ops: Array<() => Promise<unknown>> = [];

  for (const name of HOURLY_15) {
    const p = await one(name);
    if (!p) continue;
    console.log(`  ${name} [${p.status}]: ${p.contract!.type} rate ${p.contract!.hourlyRateCents ?? "none"} -> HOURLY $15/h`);
    ops.push(() => ServiceProject.updateOne({ _id: p._id }, { $set: { "contract.type": "HOURLY", "contract.hourlyRateCents": 1500 } }));
  }
  for (const name of FIXED_TYPE) {
    const p = await one(name);
    if (!p) continue;
    console.log(`  ${name} [${p.status}]: ${p.contract!.type} rate ${p.contract!.hourlyRateCents ?? "none"} -> FIXED, billed by the hours at $15/h`);
    ops.push(() => ServiceProject.updateOne({ _id: p._id }, { $set: { "contract.type": "FIXED", "contract.hourlyRateCents": 1500 } }));
  }

  const robert = await one("Robert");
  if (robert) {
    if ((await ServiceProject.countDocuments({ name: "Robert Lewis" })) > 0 || (await ServiceClient.countDocuments({ name: "Robert Lewis" })) > 0) {
      console.log('  Robert: a project or client named "Robert Lewis" already exists; skipped');
    } else {
      console.log(`  Robert [${robert.status}]: renamed "Robert Lewis" (project and client), ${robert.contract!.type} rate ${robert.contract!.hourlyRateCents ?? "none"} / weekly ${robert.contract!.weeklyLimitMinutes ?? "none"} -> HOURLY $15/h, 15 h a week`);
      ops.push(
        () => ServiceProject.updateOne({ _id: robert._id }, { $set: { name: "Robert Lewis", "contract.type": "HOURLY", "contract.hourlyRateCents": 1500, "contract.weeklyLimitMinutes": 900 } }),
        () => ServiceClient.updateOne({ _id: robert.clientId }, { $set: { name: "Robert Lewis" } })
      );
    }
  }
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  for (const op of ops) await op();
  await recordServiceAudit("projects.set_live_unset", { operations: ops.length, via: "scripts/set-live-unset-projects.ts" });
  console.log(`Done: ${ops.length} updates.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
