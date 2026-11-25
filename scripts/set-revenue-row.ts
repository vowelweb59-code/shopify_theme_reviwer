import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceRevenueTaken } from "@/models/service-revenue";

// Corrects the amount of ONE imported sales-sheet row without re-importing the month (the month's JSON is not always kept). Dry run unless
// --apply; refuses unless exactly one row matches. The amount is an argument, never written into the code or the repository:
//
//   npx tsx --env-file=.env.production.local scripts/set-revenue-row.ts --month=2026-10 --client="Iyke J" --total=150 [--profile=Ashfaque] [--apply]
//
// --total is in dollars (the sheet's TOTAL AMT); a refund is negative. Audit action: revenue.set_row.
const apply = process.argv.includes("--apply");
const arg = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();

async function main() {
  const month = arg("month");
  const client = arg("client");
  const profile = arg("profile");
  const totalText = arg("total");
  const total = totalText === undefined || totalText === "" ? NaN : Number(totalText);
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !client || !Number.isFinite(total)) {
    throw new Error('Usage: set-revenue-row.ts --month=YYYY-MM --client="Name" --total=<dollars> [--profile=Name] [--apply]');
  }
  await connectToDatabase();
  const filter = { month, clientName: client, ...(profile ? { profile } : {}) };
  const rows = await ServiceRevenueTaken.find(filter).lean();
  if (rows.length !== 1)
    throw new Error(`Expected exactly one row for ${month} / ${client}${profile ? ` / ${profile}` : ""}, found ${rows.length}. Nothing changed.`);
  const row = rows[0];
  const newCents = Math.round(total * 100);
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: ${month} ${row.clientName} (${row.profile ?? "no profile"}): ${(row.amountCents / 100).toFixed(2)} -> ${(newCents / 100).toFixed(2)}`
  );
  if (!apply) return console.log("Nothing written. Add --apply to save.");
  await ServiceRevenueTaken.updateOne({ _id: row._id }, { $set: { amountCents: newCents } });
  await recordServiceAudit("revenue.set_row", { month, client: row.clientName, profile: row.profile, fromCents: row.amountCents, toCents: newCents });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
