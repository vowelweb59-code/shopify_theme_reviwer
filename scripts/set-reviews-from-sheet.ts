import ExcelJS from "exceljs";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { nameKey } from "@/lib/service/import/ended-posts";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";

// Fills the closing review of closed projects that have none from the owner's "All Upwork Project List - 2019 - 2026.xlsx" (owner,
// 2026-11-24). Columns read: CLIENT NAME, PROFILE's, END DATE, FINAL REVIEW, CHANGED REVIEW (the changed review wins when there is one).
// Only a number from 1 to 5 counts ("NA" and blanks give nothing). A project is filled only when its client's matching rows (the profile
// narrows them when the client has several) all give the same number; a project that already has a review is never touched. Dry run unless
// --apply (the owner runs it), audit `projects.set_reviews_from_sheet`:
//   npx tsx --env-file=.env.production.local scripts/set-reviews-from-sheet.ts "<path to xlsx>" [--apply]
const apply = process.argv.includes("--apply");
const file = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));

interface SheetRow {
  client: string;
  profile: string | null;
  end: Date | null;
  rating: number | null;
}

const cellText = (v: ExcelJS.CellValue): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object")
    return "richText" in v
      ? v.richText
          .map((t) => t.text)
          .join("")
          .trim() || null
      : "result" in v
        ? cellText(v.result as ExcelJS.CellValue)
        : null;
  return String(v).trim() || null;
};
const asRating = (s: string | null) => (s && /^\d(\.\d+)?$/.test(s) && +s >= 1 && +s <= 5 ? +s : null);

async function readSheet(path: string): Promise<SheetRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheet.");
  const head = new Map<string, number>();
  ws.getRow(1).eachCell((c, col) => {
    const t = cellText(c.value);
    if (t) head.set(t.toUpperCase(), col);
  });
  const col = (name: string) => {
    const c = [...head].find(([k]) => k.startsWith(name))?.[1];
    if (!c) throw new Error(`Column "${name}" not found in the first row.`);
    return c;
  };
  const [cClient, cProfile, cEnd, cFinal, cChanged] = [col("CLIENT NAME"), col("PROFILE"), col("END DATE"), col("FINAL REVIEW"), col("CHANGED REVIEW")];
  const out: SheetRow[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const client = cellText(row.getCell(cClient).value);
    if (!client) return;
    const end = row.getCell(cEnd).value;
    out.push({
      client,
      profile: cellText(row.getCell(cProfile).value),
      end: end instanceof Date ? end : null,
      rating: asRating(cellText(row.getCell(cChanged).value)) ?? asRating(cellText(row.getCell(cFinal).value)),
    });
  });
  return out;
}

async function main() {
  if (!file) throw new Error('Usage: set-reviews-from-sheet.ts "<path to xlsx>" [--apply]');
  const rows = await readSheet(file);
  await connectToDatabase();
  const byClient = new Map<string, SheetRow[]>();
  for (const r of rows) byClient.set(nameKey(r.client), [...(byClient.get(nameKey(r.client)) ?? []), r]);
  const profiles = new Map(
    (await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((p) => [
      p._id,
      [p.name, ...(p.aliases ?? [])].map(nameKey),
    ])
  );
  const clients = new Map(
    (await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((c) => [
      c._id,
      [c.name, ...(c.aliases ?? [])].map(nameKey),
    ])
  );
  const closed = await ServiceProject.find({ status: { $in: ["COMPLETED", "CANCELLED", "ARCHIVED"] }, reviewRating: null })
    .select("name clientId upworkProfileId")
    .lean<Array<{ _id: string; name: string; clientId: string | null; upworkProfileId: string | null }>>();

  const todo: Array<{ id: string; name: string; rating: number; end: Date | null }> = [];
  for (const p of closed) {
    let cand = (p.clientId ? (clients.get(p.clientId) ?? []) : []).flatMap((k) => byClient.get(k) ?? []);
    const pk = p.upworkProfileId ? (profiles.get(p.upworkProfileId) ?? []) : [];
    if (cand.length > 1 && pk.length) {
      const m = cand.filter((r) => r.profile && pk.includes(nameKey(r.profile)));
      if (m.length) cand = m;
    }
    const rated = cand.filter((r) => r.rating != null);
    const values = new Set(rated.map((r) => r.rating));
    if (values.size !== 1) continue;
    const ends = rated.map((r) => r.end).filter((d): d is Date => !!d);
    todo.push({ id: p._id, name: p.name, rating: rated[0]!.rating!, end: ends.length ? new Date(Math.max(...ends.map((d) => +d))) : null });
  }

  console.log(`${apply ? "APPLYING" : "Dry run"}: ${todo.length} of ${closed.length} closed projects without a review can be filled from the sheet.`);
  for (const t of todo) console.log(`  ${t.name}: ${t.rating}★${t.end ? ` (ended ${t.end.toISOString().slice(0, 10)})` : ""}`);
  if (!apply) return console.log("Nothing written. Add --apply to save them.");
  const filled: string[] = [];
  for (const t of todo) {
    const r = await ServiceProject.updateOne({ _id: t.id, reviewRating: null }, { $set: { reviewRating: t.rating, reviewedAt: t.end } });
    if (r.modifiedCount) filled.push(t.name);
  }
  await recordServiceAudit("projects.set_reviews_from_sheet", { filled });
  console.log(`Saved ${filled.length} reviews.`);
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
