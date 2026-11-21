import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { ServiceProject } from "@/models/service-project";

// Sets a Service project's type, price, BA and BD by hand (first case, 2026-11-17: "Janell Saverin – Burhan", a $600 fixed project
// with BA Trupti and BD Ali Asger Bagichawala; it was created without them). The project is found by its exact name.
//
// A dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/set-service-project.ts "Janell Saverin – Burhan" --fixed 600 --ba Trupti --bd "Ali Asger Bagichawala" [--apply]
// Options: --fixed <USD> (fixed price), --rate <USD> (hourly rate), --limit-hours <H> (weekly hours), --ba <name>, --bd <name>.
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const name = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));

async function main() {
  if (!name) throw new Error('Usage: set-service-project.ts "<Project name>" [--fixed USD] [--rate USD] [--limit-hours H] [--ba N] [--bd N] [--apply]');
  await connectToDatabase();
  const found = await ServiceProject.find({ name }).select("name status contract people").lean<
    Array<{
      _id: string;
      name: string;
      status: string;
      contract: Record<string, unknown> | null;
      people: Array<{ role: string; name: string; senderId: string | null }>;
    }>
  >();
  if (found.length !== 1) throw new Error(`${found.length} projects are named "${name}"; need exactly one.`);
  const p = found[0];

  const set: Record<string, unknown> = {};
  const fixed = flag("fixed");
  if (fixed) {
    set["contract.type"] = "FIXED";
    set["contract.fixedPriceCents"] = Math.round(Number(fixed) * 100);
  }
  if (flag("rate")) set["contract.hourlyRateCents"] = Math.round(Number(flag("rate")) * 100);
  if (flag("limit-hours")) set["contract.weeklyLimitMinutes"] = Math.round(Number(flag("limit-hours")) * 60);
  if (Object.keys(set).length && !p.contract) throw new Error("This project has no contract yet; set one in the app first.");
  let people = p.people;
  for (const [flagName, role] of [
    ["ba", "BUSINESS_ANALYST"],
    ["bd", "BUSINESS_DEVELOPER"],
  ] as const) {
    const v = flag(flagName);
    if (v) people = [...people.filter((x) => x.role !== role), { role, name: v, senderId: null }];
  }
  if (people !== p.people) set.people = people;

  console.log(`${apply ? "APPLYING" : "Dry run"}: "${p.name}" (${p.status})`);
  for (const [k, v] of Object.entries(set)) console.log(`  ${k} = ${JSON.stringify(v)}`);
  if (fixed) console.log(`  = ${(workableMinutes(Math.round(Number(fixed) * 100))! / 60).toFixed(1)} workable hours at $15/h`);
  if (!Object.keys(set).length) return console.log("Nothing to change.");
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  await ServiceProject.updateOne({ _id: p._id }, { $set: set });
  await recordServiceAudit("project.update", { projectId: p._id, fields: Object.keys(set), via: "scripts/set-service-project.ts" });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
