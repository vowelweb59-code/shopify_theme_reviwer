import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { computeAnalytics, type AppRow } from "@/lib/shopifyApps/analytics";
import { DETAIL_VERSION, detailBacklog } from "@/lib/shopifyApps/crawlApps";
import { stagesOfApp } from "@/lib/shopifyApps/lifecycle";
import { topicsOfApp } from "@/lib/shopifyApps/topics";
import { pricingModel } from "@/lib/shopifyApps/parseApps";
import { ShopifyApp, ShopifyAppCategory } from "@/models/shopify-app";

type Row = AppRow & { tagline: string | null; lastSeenAt: Date; detailVersion: number };

// GET /api/shopify-apps — every App Store app read so far, classified by lifecycle stage, with the gap analytics. Filtering happens in the tab.
export async function GET() {
  await connectToDatabase();
  const [rows, categories, watchedRows, backlog] = await Promise.all([
    ShopifyApp.find({}).sort({ reviewCount: -1 }).select("-_id handle name tagline rating reviewCount pricingLabel builtForShopify categories developer launchedAt ratingShares lastSeenAt detailVersion").lean<Row[]>(),
    ShopifyAppCategory.find({}).select("-_id slug label").lean<{ slug: string; label: string }[]>(),
    ShopifyAppCategory.find({ priority: true }).select("-_id slug label lastReadAt").lean<{ slug: string; label: string; lastReadAt: Date | null }[]>(),
    detailBacklog(),
  ]);
  return NextResponse.json({
    // Watched categories (FAQ from the start): re-read weekly and before everything else.
    watched: watchedRows.map((c) => {
      const apps = rows.filter((r) => r.categories.includes(c.slug));
      return { slug: c.slug, label: c.label, apps: apps.length, read: apps.filter((r) => r.detailVersion >= DETAIL_VERSION).length, lastReadAt: c.lastReadAt };
    }),
    // How far the rolling read of app pages has got: pages read at the current depth, of all apps, and how many are waiting.
    detail: { read: rows.filter((r) => r.detailVersion >= DETAIL_VERSION).length, total: rows.length, backlog },
    lastCrawledAt: rows.reduce<Date | null>((latest, r) => (!latest || r.lastSeenAt > latest ? r.lastSeenAt : latest), null),
    analytics: computeAnalytics(rows, categories),
    // Finer cuts of the same apps: category › topic, and a topic across categories.
    levels: { niche: computeAnalytics(rows, categories, new Date(), "niche"), topic: computeAnalytics(rows, categories, new Date(), "topic") },
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
      topics: topicsOfApp(r.name, r.tagline),
      developer: r.developer,
      launchedAt: r.launchedAt,
    })),
  });
}
