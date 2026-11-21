import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceProject } from "@/models/service-project";

// Sets the business developer of the projects the owner classified on 2026-11-21 (the 12 running / on-hold projects whose BD was written as
// plain "Aliasger", which could be Ali Asger Bagichawala or Ali Asger Ezzi). The BD people entry is replaced by the name below; `null` removes
// it. Only the BD changes. Audit `projects.set_bd`. Dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/set-project-bd.ts [--apply]
//
// Not here: the 69 completed projects still written "Aliasger" (not classified yet).
const EZZI = "Ali Asger Ezzi";
const BAGICHAWALA = "Ali Asger Bagichawala";
const ASSIGNMENTS: Array<{ project: string; bd: string | null; note?: string }> = [
  { project: "Tim Fitz", bd: EZZI },
  { project: "Swarnima Sanganeri", bd: null, note: "Direct client, no BD" },
  { project: "Sal Joya", bd: EZZI },
  { project: "Chris Crouch", bd: BAGICHAWALA },
  { project: "Sanjeev Prakash – Taha", bd: "Amreen", note: "Amreen has left the company" },
  { project: "Robert Lewis", bd: "Pranit" },
  { project: "Mahogany Monet", bd: EZZI },
  { project: "Robert Miller", bd: EZZI },
  { project: "Ebru Coffee", bd: EZZI },
  { project: "Leesa McGregor", bd: EZZI, note: "read from \"Leesa Macregor - and Adina Las Vegas - Ezzi\": check" },
  { project: "Adina Las Vegas", bd: EZZI },
  { project: "Dan Staggs", bd: "Mohit", note: "kept in the app (owner 2026-11-21), BD Mohit" },
];

const apply = process.argv.includes("--apply");

async function main() {
  await connectToDatabase();
  let changed = 0;
  for (const a of ASSIGNMENTS) {
    const found = await ServiceProject.find({ name: a.project }).select("name people").lean<Array<{ _id: string; name: string; people: Array<{ role: string; name: string; senderId: string | null }> }>>();
    if (found.length !== 1) { console.log(`SKIP  "${a.project}": ${found.length} projects with that name`); continue; }
    const p = found[0]!;
    const current = p.people.filter((x) => x.role === "BUSINESS_DEVELOPER").map((x) => x.name);
    const same = (a.bd === null && current.length === 0) || (a.bd !== null && current.length === 1 && current[0] === a.bd);
    console.log(`${same ? "same  " : apply ? "SET   " : "would "} ${p.name}: BD ${current.join(" + ") || "none"} -> ${a.bd ?? "none"}${a.note ? `  (${a.note})` : ""}`);
    if (same) continue;
    changed++;
    if (!apply) continue;
    const people = [...p.people.filter((x) => x.role !== "BUSINESS_DEVELOPER"), ...(a.bd ? [{ role: "BUSINESS_DEVELOPER", name: a.bd, senderId: null }] : [])];
    await ServiceProject.updateOne({ _id: p._id }, { $set: { people } });
  }
  if (apply && changed) await recordServiceAudit("projects.set_bd", { changed, projects: ASSIGNMENTS.map((a) => a.project) });
  console.log(apply ? `Done: ${changed} projects changed.` : `Dry run: ${changed} projects would change. Add --apply to save them.`);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
