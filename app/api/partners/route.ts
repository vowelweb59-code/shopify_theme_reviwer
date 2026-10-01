import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { countryLabel } from "@/lib/partners/parseDirectory";
import { ShopifyPartner } from "@/models/shopify-partner";

type PartnerRow = {
  slug: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  location: string | null;
  countrySlugs: string[];
  tier: string | null;
  startingPrice: number | null;
  services: string[];
  moreServices: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

// GET /api/partners — every stored partner (a few thousand rows) plus the country list with counts.
// Filtering and searching happen in the tab, so one request serves every filter change.
export async function GET() {
  await connectToDatabase();
  const [partners, countries] = await Promise.all([
    ShopifyPartner.find({}).sort({ reviewCount: -1, name: 1 }).lean<PartnerRow[]>(),
    ShopifyPartner.aggregate<{ _id: string; n: number }>([{ $unwind: "$countrySlugs" }, { $group: { _id: "$countrySlugs", n: { $sum: 1 } } }]),
  ]);
  return NextResponse.json({
    countries: countries.map((c) => ({ slug: c._id, label: countryLabel(c._id), count: c.n })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    lastCrawledAt: partners.reduce<Date | null>((latest, p) => (!latest || p.lastSeenAt > latest ? p.lastSeenAt : latest), null),
    partners: partners.map((p) => ({
      slug: p.slug,
      name: p.name,
      url: `https://www.shopify.com/partners/directory/partner/${p.slug}`,
      rating: p.rating,
      reviewCount: p.reviewCount,
      location: p.location,
      countrySlugs: p.countrySlugs,
      tier: p.tier ?? null,
      startingPrice: p.startingPrice,
      services: p.services,
      moreServices: p.moreServices,
      firstSeenAt: p.firstSeenAt,
    })),
  });
}
