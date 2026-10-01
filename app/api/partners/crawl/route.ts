import { NextResponse } from "next/server";
import { partnerCrawlProgress, startPartnerCrawl } from "@/lib/partners/crawlPartners";

// GET /api/partners/crawl — progress of the directory crawl.
export async function GET() {
  return NextResponse.json(partnerCrawlProgress());
}

// POST /api/partners/crawl — start a full crawl in the background (no-op while one runs).
export async function POST() {
  startPartnerCrawl();
  return NextResponse.json(partnerCrawlProgress(), { status: 202 });
}
