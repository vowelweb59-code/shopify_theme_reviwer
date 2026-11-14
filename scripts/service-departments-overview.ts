/**
 * Read-only: the Service departments (name, manager, default) and how many projects, project statuses and hours entries fall in
 * each (a project's department follows its manager: lib/service/reports/project-departments.ts).
 *
 *   npx tsx --env-file=.env.production.local scripts/service-departments-overview.ts
 */
import { connectToDatabase } from "../lib/db/connect";
import { loadProjectDepartments } from "../lib/service/reports/project-departments";
import { ServiceTimeEntry } from "../models/service-time-entry";

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const { departments, deptOf, projects } = await loadProjectDepartments();
  const hours = await ServiceTimeEntry.aggregate([{ $group: { _id: "$projectId", n: { $sum: 1 } } }]);
  const entries = new Map<string, number>(hours.map((h: { _id: string | null; n: number }) => [String(h._id), h.n]));
  console.log(`${projects.length} projects in all\n`);
  for (const d of [...departments, { _id: "none", name: "(no department)", isDefault: false, managerName: null }]) {
    const mine = projects.filter((p) => (deptOf.get(p._id) ?? "none") === d._id);
    const withEntries = mine.filter((p) => (entries.get(p._id) ?? 0) > 0).length;
    console.log(`${d.name}${d.isDefault ? " [default]" : ""}  manager: ${d.managerName ?? "-"}  ->  ${mine.length} projects (${withEntries} with hours entries)`);
    for (const p of mine.slice(0, 6)) console.log(`     e.g. ${p.name}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
