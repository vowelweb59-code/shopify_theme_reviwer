import { NextResponse } from "next/server";
import { triggerThemeRankingCheckNow } from "@/lib/themes/rankingScheduler";

export async function POST() {
  await triggerThemeRankingCheckNow();
  return NextResponse.json({ ok: true });
}
