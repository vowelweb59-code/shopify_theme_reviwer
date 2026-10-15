import { NextResponse } from "next/server";
import { startThemeStoreCrawl, themeStoreCrawlProgress } from "@/lib/themeStore/crawlCatalog";

// GET /api/theme-store/crawl — progress of the Theme Store read.
export async function GET() {
  return NextResponse.json(themeStoreCrawlProgress());
}

// POST /api/theme-store/crawl — start reading every Theme Store theme in the background (no-op while one runs).
export async function POST() {
  startThemeStoreCrawl();
  return NextResponse.json(themeStoreCrawlProgress(), { status: 202 });
}
