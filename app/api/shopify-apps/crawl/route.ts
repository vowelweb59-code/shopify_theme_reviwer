import { NextResponse } from "next/server";
import { shopifyAppsCrawlProgress, startShopifyAppsCrawl } from "@/lib/shopifyApps/crawlApps";

// GET /api/shopify-apps/crawl — progress of the App Store read.
export async function GET() {
  return NextResponse.json(shopifyAppsCrawlProgress());
}

// POST /api/shopify-apps/crawl — start reading the App Store in the background (no-op while one runs).
export async function POST() {
  startShopifyAppsCrawl();
  return NextResponse.json(shopifyAppsCrawlProgress(), { status: 202 });
}
