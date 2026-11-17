import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceRevenueTaken } from "@/models/service-revenue";

// Loads the money actually taken from clients (owner's sheet "SEO SALES - HUZEFA.xlsx", column TOTAL AMT, one tab per month) into
// `service_revenue_taken`, for the Revenue tab. The sheet is turned into a JSON file first (month, section, client, profile, bde,
// total), kept OUTSIDE the repository: the amounts are not written into the code or the repo. Replaces the whole collection, so
// running it again with a newer sheet is safe.
//
// A dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/import-revenue-sheet.ts "C:\path\revenue-taken.json" [--apply]
const apply = process.argv.includes("--apply");
const file = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));

interface Row { month: string; section: string | null; client: string; profile: string | null; bde: string | null; total: number }

async function main() {
  if (!file) throw new Error('Usage: import-revenue-sheet.ts "<path to revenue-taken.json>" [--apply]');
  const rows = JSON.parse(readFileSync(file, "utf-8")) as Row[];
  if (!Array.isArray(rows) || !rows.length) throw new Error("The file has no rows.");
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const total = rows.reduce((n, r) => n + r.total, 0);
  console.log(`${apply ? "APPLYING" : "Dry run"}: ${rows.length} rows, ${new Set(rows.map((r) => r.client)).size} client names, ${months[0]} to ${months[months.length - 1]}, total ${total.toFixed(2)}`);
  await connectToDatabase();
  console.log(`  The collection now holds ${await ServiceRevenueTaken.countDocuments()} rows; they will be replaced.`);
  if (!apply) return console.log("Nothing written. Add --apply to import.");
  await ServiceRevenueTaken.deleteMany({});
  await ServiceRevenueTaken.insertMany(rows.map((r) => ({ _id: randomUUID(), month: r.month, clientName: r.client, section: r.section, profile: r.profile, bde: r.bde, amountCents: Math.round(r.total * 100) })));
  await recordServiceAudit("revenue.import", { rows: rows.length, months: months.length });
  console.log("Done.");
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
