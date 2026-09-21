import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { DemoStoreCheckState } from "@/models/demo-store-check-state";

export async function GET() {
  await connectToDatabase();
  const [records, state] = await Promise.all([DemoStoreThemeRecord.find().sort({ startedAt: -1 }), DemoStoreCheckState.findOne()]);

  return NextResponse.json({
    records,
    lastCheckedAt: state?.lastCheckedAt ?? null,
    nextCheckAt: state?.nextCheckAt ?? null,
    lastError: state?.lastError ?? null,
  });
}
