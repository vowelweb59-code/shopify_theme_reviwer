import { NextResponse } from "next/server";
import { triggerDemoStoreCheckNow } from "@/lib/demoStore/scheduler";

export async function POST() {
  await triggerDemoStoreCheckNow();
  return NextResponse.json({ ok: true });
}
