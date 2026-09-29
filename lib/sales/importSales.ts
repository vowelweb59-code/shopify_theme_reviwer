import "server-only";
import type { Types } from "mongoose";
import { SaleRecord } from "@/models/sale-record";
import { SalesStore } from "@/models/sales-store";
import type { ParsedSale } from "./parseSalesFile";

export type ImportResult = { inserted: number; duplicates: number; newStores: number };

/** Same store + time + charge type + amount = the same sale, whichever upload it came from. */
export function saleDedupeKey(themeId: string, s: Pick<ParsedSale, "shopDomain" | "soldAt" | "chargeType" | "amount">): string {
  return [themeId, s.shopDomain, s.soldAt.toISOString(), s.chargeType, s.amount].join("|");
}

/**
 * Adds the sheet's rows for one theme. Rows already imported are skipped
 * (the user's "add new rows only" choice), so re-uploading an updated sheet
 * is safe. Every new store domain gets a pending SalesStore row for the
 * preset detection job to pick up.
 */
export async function importSales(themeId: Types.ObjectId | string, sales: ParsedSale[]): Promise<ImportResult> {
  const id = String(themeId);
  const docs = sales.map((s) => ({ ...s, themeId: id, dedupeKey: saleDedupeKey(id, s) }));

  let inserted = 0;
  if (docs.length > 0) {
    try {
      const res = await SaleRecord.insertMany(docs, { ordered: false });
      inserted = res.length;
    } catch (err) {
      // ordered:false keeps going past duplicate-key errors; count what landed.
      const e = err as { code?: number; insertedDocs?: unknown[]; writeErrors?: { code?: number }[] };
      const onlyDuplicates = (e.writeErrors ?? []).every((w) => w.code === 11000) || e.code === 11000;
      if (!onlyDuplicates) throw err;
      inserted = e.insertedDocs?.length ?? 0;
    }
  }

  const domains = [...new Set(sales.map((s) => s.shopDomain))];
  let newStores = 0;
  if (domains.length > 0) {
    const res = await SalesStore.bulkWrite(
      domains.map((shopDomain) => ({
        updateOne: { filter: { themeId: id, shopDomain }, update: { $setOnInsert: { themeId: id, shopDomain, status: "pending" } }, upsert: true },
      }))
    );
    newStores = res.upsertedCount;
  }

  return { inserted, duplicates: docs.length - inserted, newStores };
}
