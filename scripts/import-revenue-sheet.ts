import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceRevenueTaken } from "@/models/service-revenue";

// Loads the money actually taken from clients (the owner's sales sheet "SEO SALES - HUZEFA.xlsx": one tab per month, column TOTAL AMT per
// client) into `service_revenue_taken`, for the Revenue tab. From 2026-11-17 the owner adds each new month from the terminal:
//
//   npx tsx --env-file=.env.production.local scripts/import-revenue-sheet.ts "C:\path\SEO SALES - HUZEFA.xlsx" --months=2026-10 [--apply]
//
// - The file can be the xlsx itself (read directly) or a JSON list of { month, section, client, profile, bde, total }.
// - --months=2026-10,2026-11 replaces only those months and leaves the others alone (use it every month). Without --months the whole
//   collection is replaced by the file, so only do that with the full sheet.
// - A dry run unless --apply. Amounts are never written into the code or the repository.
const apply = process.argv.includes("--apply");
const file = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
const onlyMonths =
  process.argv
    .find((a) => a.startsWith("--months="))
    ?.slice(9)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean) ?? null;

interface Row {
  month: string;
  section: string | null;
  client: string;
  profile: string | null;
  bde: string | null;
  total: number;
}

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Sep26", "December2025", "Mar 25", "APRIL 24" -> "2026-09" ... */
function sheetMonth(title: string): string | null {
  const m = /^\s*([A-Za-z]{3})[A-Za-z]*\s*(\d{2,4})\s*$/.exec(title);
  if (!m) return null;
  const idx = MON.indexOf(m[1].toLowerCase());
  if (idx < 0) return null;
  const y = Number(m[2]);
  return `${y < 100 ? 2000 + y : y}-${String(idx + 1).padStart(2, "0")}`;
}

function plain(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "object" && "result" in v) return plain((v as { result: ExcelJS.CellValue }).result);
  if (typeof v === "object" && "richText" in v) return (v as { richText: Array<{ text: string }> }).richText.map((t) => t.text).join("");
  return null;
}

async function readXlsx(path: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const rows: Row[] = [];
  for (const ws of wb.worksheets) {
    const month = sheetMonth(ws.name);
    if (!month) {
      console.log(`  skipped tab "${ws.name}" (not a month)`);
      continue;
    }
    let section: string | null = null;
    ws.eachRow({ includeEmpty: false }, (r, n) => {
      if (n < 3) return;
      const [a, b, c, d, e, f] = [1, 2, 3, 4, 5, 6].map((i) => plain(r.getCell(i).value));
      const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
      if (str(b) && [c, d, e, f].every((x) => x === null) && typeof a !== "number") {
        section = str(b);
        return;
      }
      if (str(a) && [b, c, d, e, f].every((x) => x === null)) {
        section = str(a);
        return;
      }
      // Summary rows ("TOTAL" at the foot of a tab) are not clients.
      if (/^\s*(grand\s+|sub\s*)?total(\s|$)/i.test(str(b) ?? "")) return;
      if (str(b) && typeof e === "number") rows.push({ month, section, client: str(b)!, profile: str(c), bde: str(d), total: e });
    });
  }
  return rows;
}

async function main() {
  if (!file) throw new Error('Usage: import-revenue-sheet.ts "<xlsx or json>" [--months=2026-10,2026-11] [--apply]');
  const all = file.toLowerCase().endsWith(".xlsx") ? await readXlsx(file) : (JSON.parse(readFileSync(file, "utf-8")) as Row[]);
  if (!Array.isArray(all) || !all.length) throw new Error("The file has no rows.");
  const rows = onlyMonths ? all.filter((r) => onlyMonths.includes(r.month)) : all;
  if (!rows.length) throw new Error(`No rows for ${onlyMonths?.join(", ")}. The file has: ${[...new Set(all.map((r) => r.month))].sort().join(", ")}`);
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const total = rows.reduce((n, r) => n + r.total, 0);
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: ${rows.length} rows, ${new Set(rows.map((r) => r.client)).size} client names, ${months.length} month(s) ${months[0]}${months.length > 1 ? ` to ${months[months.length - 1]}` : ""}, total ${total.toFixed(2)}`
  );
  await connectToDatabase();
  const replacing = await ServiceRevenueTaken.countDocuments(onlyMonths ? { month: { $in: months } } : {});
  console.log(`  ${onlyMonths ? `Months ${months.join(", ")} hold` : "The collection holds"} ${replacing} rows now; they will be replaced.`);
  if (!apply) return console.log("Nothing written. Add --apply to import.");
  await ServiceRevenueTaken.deleteMany(onlyMonths ? { month: { $in: months } } : {});
  await ServiceRevenueTaken.insertMany(
    rows.map((r) => ({
      _id: randomUUID(),
      month: r.month,
      clientName: r.client,
      section: r.section,
      profile: r.profile,
      bde: r.bde,
      amountCents: Math.round(r.total * 100),
    }))
  );
  await recordServiceAudit("revenue.import", { rows: rows.length, months: months.length, scope: onlyMonths ? "months" : "all" });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
