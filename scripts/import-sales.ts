/**
 * Monthly sales import from the backend: the same parsing, month filter, name repair and de-duplication as
 * Sales → Import in the app, run against whatever database MONGODB_URI points at.
 *
 *   npm run sales:import -- <file> --month 2026-10                 # dry run: shows what would be added
 *   npm run sales:import -- <file> --month 2026-10 --apply         # does it
 *
 * <file> is either
 *   - a .xlsx workbook with one tab per theme (tab name = theme name), or
 *   - a .json file shaped { "Adorn": "<rows copied from the sheet>", "Voltix": "<rows>", ... }.
 * --month limits the import to one month (UTC, as in the sheet); leave it out to import every month.
 * A dry run changes nothing. Rows already imported are skipped either way, so re-running a month is safe.
 *
 * Against the live database, load its env file:
 *   npx tsx --env-file=.env.production.local scripts/import-sales.ts <file> --month 2026-10 [--apply]
 */
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db/connect";
import { isXlsx, matchThemeForTab, onlyMonth, parseDelimited, parseMonth, readWorkbook, salesFromRows, type ParsedSale } from "../lib/sales/parseSalesFile";
import { importSales, saleDedupeKey } from "../lib/sales/importSales";
import { SaleRecord } from "../models/sale-record";
import { Theme } from "../models/theme";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--month");
const apply = args.includes("--apply");
const monthArg = args.includes("--month") ? args[args.indexOf("--month") + 1] : undefined;
const month = monthArg ? parseMonth(monthArg) : null;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function tabsOf(path: string): Promise<{ name: string; rows: string[][] }[]> {
  const buffer = readFileSync(path);
  if (isXlsx(buffer, path)) return readWorkbook(buffer);
  const json = JSON.parse(buffer.toString("utf8")) as Record<string, string>;
  return Object.entries(json).map(([name, text]) => ({ name, rows: parseDelimited(text.replace(/^﻿/, "")) }));
}

async function main() {
  if (!file) fail("Usage: sales:import <file.xlsx|file.json> [--month YYYY-MM] [--apply]");
  if (monthArg && !month) fail(`--month must look like 2026-10 (got "${monthArg}").`);

  const tabs = await tabsOf(file);
  await connectToDatabase();
  console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);
  console.log(`${apply ? "APPLYING" : "Dry run (nothing is written; add --apply to import)"} · ${month ? `month ${month}` : "all months"}\n`);

  const themes = await Theme.find({}).select("name").lean<{ _id: unknown; name: string }[]>();
  let added = 0;
  let problems = 0;
  for (const tab of tabs) {
    const theme = matchThemeForTab(tab.name, themes);
    if (!theme) {
      console.log(`✗ ${tab.name}: no theme with this name (themes: ${themes.map((t) => t.name).join(", ")})`);
      problems++;
      continue;
    }
    let sales: ParsedSale[];
    let skipped: number;
    try {
      const parsed = salesFromRows(tab.rows, { headerOptional: true });
      sales = parsed.sales;
      skipped = parsed.skipped;
    } catch (err) {
      console.log(`✗ ${tab.name}: ${err instanceof Error ? err.message : String(err)}`);
      problems++;
      continue;
    }
    const picked = onlyMonth(sales, month);
    const id = String(theme._id);
    const existing = await SaleRecord.countDocuments({ dedupeKey: { $in: picked.sales.map((s) => saleDedupeKey(id, s)) } });
    const gross = picked.sales.reduce((n, s) => n + s.amount, 0);
    const refunds = picked.sales.filter((s) => s.amount < 0).length;
    console.log(
      `✓ ${tab.name}${theme.name !== tab.name ? ` → ${theme.name}` : ""}: ${picked.sales.length} rows in range (${refunds} refund${refunds === 1 ? "" : "s"}), net ${gross}, ` +
        `${existing} already in the database, ${picked.otherMonths} from other months left out, ${skipped} blank/undated ignored`
    );
    if (apply && picked.sales.length > 0) {
      const result = await importSales(id, picked.sales);
      added += result.inserted;
      console.log(`    imported ${result.inserted} new, ${result.duplicates} duplicate, ${result.newStores} new stores`);
    }
  }
  console.log(apply ? `\nDone: ${added} sales added${problems ? `, ${problems} tab(s) had problems` : ""}.` : `\nDry run finished${problems ? `, ${problems} tab(s) had problems` : ""}. Nothing was changed.`);
  if (apply && added > 0) console.log("New stores are marked pending; the app's preset detection picks them up on its next run.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
