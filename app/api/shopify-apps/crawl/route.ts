import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { shopifyAppsCrawlProgress, startCategoryRead, startShopifyAppsCrawl } from "@/lib/shopifyApps/crawlApps";
import { ShopifyAppCategory } from "@/models/shopify-app";

// GET /api/shopify-apps/crawl — progress of the App Store read.
export async function GET() {
  return NextResponse.json(shopifyAppsCrawlProgress());
}

// POST /api/shopify-apps/crawl — start reading the App Store in the background (no-op while one runs).
// Body { category: "<slug>" } reads just that category and every app in it, freshly; without it, the full read.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { category?: unknown } | null;
  if (body?.category !== undefined) {
    const slug = typeof body.category === "string" ? body.category : "";
    await connectToDatabase();
    if (!slug || !(await ShopifyAppCategory.exists({ slug }))) return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    startCategoryRead(slug);
  } else {
    startShopifyAppsCrawl();
  }
  return NextResponse.json(shopifyAppsCrawlProgress(), { status: 202 });
}
