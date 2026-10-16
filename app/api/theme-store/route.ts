import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ThemeStoreTheme } from "@/models/theme-store-theme";

type Row = {
  slug: string;
  name: string;
  price: number | null;
  isNew: boolean;
  presets: { slug: string; name: string }[];
  industries: string[];
  designer: string | null;
  positivePercent: number | null;
  reviewCount: number | null;
  latestVersion: string | null;
  latestVersionReleasedAt: string | null;
  features: string[];
  rank: number | null;
  detailAt: Date | null;
  lastSeenAt: Date;
};

// GET /api/theme-store — every Theme Store theme read so far. Filtering and searching happen in the tab.
export async function GET() {
  await connectToDatabase();
  const rows = await ThemeStoreTheme.find({}).sort({ rank: 1, name: 1 }).lean<Row[]>();
  return NextResponse.json({
    detailsPending: rows.filter((r) => !r.detailAt).length,
    lastCrawledAt: rows.reduce<Date | null>((latest, r) => (!latest || r.lastSeenAt > latest ? r.lastSeenAt : latest), null),
    themes: rows.map((r, i) => ({
      slug: r.slug,
      name: r.name,
      url: `https://themes.shopify.com/themes/${r.slug}`,
      price: r.price,
      isNew: r.isNew,
      presetCount: r.presets.length,
      industries: r.industries,
      designer: r.designer,
      positivePercent: r.positivePercent,
      reviewCount: r.reviewCount,
      latestVersion: r.latestVersion,
      latestVersionReleasedAt: r.latestVersionReleasedAt,
      features: r.features,
      // Position among main themes only; the stored rank counts every preset card too.
      rank: i + 1,
    })),
  });
}
