import { NextResponse } from "next/server";
import { categoryCrawlProgress, startCategoryCrawl } from "@/lib/sales/categories";

// POST /api/sales/categories/refresh — crawl every Theme Store category (in the background) to update the suggestions.
export function POST() {
  startCategoryCrawl();
  return NextResponse.json(categoryCrawlProgress(), { status: 202 });
}
