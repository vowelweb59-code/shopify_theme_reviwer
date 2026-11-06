import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { computeAnalytics, type AppRow } from "@/lib/shopifyApps/analytics";
import { stagesOfApp } from "@/lib/shopifyApps/lifecycle";
import { pricingModel } from "@/lib/shopifyApps/parseApps";
import { ShopifyApp, ShopifyAppCategory } from "@/models/shopify-app";

type Row = AppRow & { tagline: string | null; lastSeenAt: Date };

// GET /api/shopify-apps — every App Store app read so far, classified by lifecycle stage, with the gap analytics. Filtering happens in the tab.
export async function GET() {
  await connectToDatabase();
  const [rows, categories] = await Promise.all([
    ShopifyApp.find({}).sort({ reviewCount: -1 }).select("-_id handle name tagline rating reviewCount pricingLabel builtForShopify categories developer launchedAt ratingShares lastSeenAt").lean<Row[]>(),
    ShopifyAppCategory.find({}).select("-_id slug label").lean<{ slug: string; label: string }[]>(),
  ]);
  return NextResponse.json({
    lastCrawledAt: rows.reduce<Date | null>((latest, r) => (!latest || r.lastSeenAt > latest ? r.lastSeenAt : latest), null),
    analytics: computeAnalytics(rows, categories),
    categoryLabels: Object.fromEntries(categories.map((c) => [c.slug, c.label])),
    apps: rows.map((r) => ({
      handle: r.handle,
      name: r.name,
      url: `https://apps.shopify.com/${r.handle}`,
      tagline: r.tagline,
      rating: r.rating,
      reviewCount: r.reviewCount,
      pricing: pricingModel(r.pricingLabel),
      builtForShopify: r.builtForShopify,
      categories: r.categories,
      stages: stagesOfApp(r.categories),
      developer: r.developer,
      launchedAt: r.launchedAt,
    })),
  });
}
