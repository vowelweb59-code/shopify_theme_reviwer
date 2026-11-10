import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DETAIL_VERSION } from "@/lib/shopifyApps/crawlApps";
import { featureBelongsTo, pricingModel, type AppPlan } from "@/lib/shopifyApps/parseApps";
import { ShopifyApp, ShopifyAppCategory, ShopifyAppFeature } from "@/models/shopify-app";

type CategoryRow = { slug: string; label: string; leaf: boolean; priority: boolean; lastReadAt: Date | null };
type AppDoc = {
  handle: string;
  name: string;
  tagline: string | null;
  rating: number | null;
  reviewCount: number;
  pricingLabel: string | null;
  builtForShopify: boolean;
  developer: string | null;
  launchedAt: string | null;
  description: string | null;
  features: string[];
  plans: AppPlan[];
  languages: string[];
  worksWith: string[];
  detailAt: Date | null;
  detailVersion: number;
};

// GET /api/shopify-apps/category?slug= — one category's apps with everything read about them (description, plans, languages,
// features) and how many of them tick each feature. The main list stays slim; this is the working view for one category.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  await connectToDatabase();
  const category = await ShopifyAppCategory.findOne({ slug }).select("-_id slug label leaf priority lastReadAt").lean<CategoryRow | null>();
  if (!category) return NextResponse.json({ error: "Unknown category." }, { status: 404 });

  const [apps, catalog] = await Promise.all([
    ShopifyApp.find({ categories: slug })
      .sort({ reviewCount: -1 })
      .select("-_id handle name tagline rating reviewCount pricingLabel builtForShopify developer launchedAt description features plans languages worksWith detailAt detailVersion")
      .lean<AppDoc[]>(),
    ShopifyAppFeature.find({}).select("-_id handle label group").lean<{ handle: string; label: string; group: string }[]>(),
  ]);
  const own = catalog.filter((f) => featureBelongsTo(f.handle, slug));
  const isRead = (a: AppDoc) => a.detailAt !== null && a.detailVersion >= DETAIL_VERSION;
  const read = apps.filter(isRead);
  const counts = new Map<string, number>();
  for (const a of read) for (const h of a.features) counts.set(h, (counts.get(h) ?? 0) + 1);

  return NextResponse.json({
    slug: category.slug,
    label: category.label,
    priority: category.priority,
    lastReadAt: category.lastReadAt,
    appCount: apps.length,
    readCount: read.length,
    features: own
      .map((f) => ({ ...f, apps: counts.get(f.handle) ?? 0, share: read.length ? (counts.get(f.handle) ?? 0) / read.length : 0 }))
      .sort((a, b) => a.group.localeCompare(b.group) || b.apps - a.apps || a.label.localeCompare(b.label)),
    apps: apps.map((a) => ({
      handle: a.handle,
      name: a.name,
      url: `https://apps.shopify.com/${a.handle}`,
      tagline: a.tagline,
      description: a.description,
      rating: a.rating,
      reviewCount: a.reviewCount,
      pricing: pricingModel(a.pricingLabel),
      builtForShopify: a.builtForShopify,
      developer: a.developer,
      launchedAt: a.launchedAt,
      read: isRead(a),
      // Only the features of this category; the app may tick others for the other categories it is listed in.
      features: a.features.filter((h) => featureBelongsTo(h, slug)),
      plans: a.plans,
      languages: a.languages,
      worksWith: a.worksWith,
    })),
  });
}

// PATCH /api/shopify-apps/category { slug, priority } — watch a category (its apps are re-read weekly and first) or stop.
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: unknown; priority?: unknown } | null;
  if (typeof body?.slug !== "string" || typeof body.priority !== "boolean") return NextResponse.json({ error: "Send { slug, priority }." }, { status: 400 });
  await connectToDatabase();
  const result = await ShopifyAppCategory.updateOne({ slug: body.slug }, { $set: { priority: body.priority } });
  if (result.matchedCount === 0) return NextResponse.json({ error: "Unknown category." }, { status: 404 });
  return NextResponse.json({ slug: body.slug, priority: body.priority });
}
