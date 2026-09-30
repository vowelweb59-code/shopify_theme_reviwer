import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { backfillDemoStoreField, readStoreCheckStates } from "@/lib/demoStore/runCheck";
import { demoStoreUrl } from "@/lib/demoStore/stores";

// GET /api/demo-store — each tracked ops demo store's live-theme history and last check.
export async function GET() {
  await connectToDatabase();
  await backfillDemoStoreField();
  const [records, { stores, nextCheckAt }] = await Promise.all([DemoStoreThemeRecord.find().sort({ startedAt: -1 }).lean<{ store: string }[]>(), readStoreCheckStates()]);

  return NextResponse.json({
    nextCheckAt,
    stores: stores.map((s) => ({
      ...s,
      url: demoStoreUrl(s.store),
      records: records.filter((r) => r.store === s.store),
    })),
  });
}
