import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ThemeRankingFilter } from "@/models/theme-ranking-filter";
import { ThemeFilteredRank } from "@/models/theme-filtered-rank";
import { runFilteredRankingCheck } from "@/lib/themes/runFilteredRankingCheck";

// Theme Store industry slugs are short kebab-case words (see the
// Collection list in app/demo-store/page.tsx). Anything else is refused
// rather than stored: every tracked filter is re-crawled daily.
const INDUSTRY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseQuery(request: Request): { sortBy: "newest" | "relevance"; industry: string | null } | { error: string } {
  const { searchParams } = new URL(request.url);
  const sortByRaw = searchParams.get("sortBy");
  const sortBy = sortByRaw === "newest" ? "newest" : "relevance";
  const industry = searchParams.get("industry") || null;
  if (industry && (industry.length > 40 || !INDUSTRY_SLUG.test(industry))) return { error: "Unknown collection." };
  // Relevance with no collection is the default ranking (/api/themes/check-ranking), not a filter.
  if (sortBy === "relevance" && !industry) return { error: "Choose a sort order or collection." };
  return { sortBy, industry };
}

async function currentRows(filterId: unknown) {
  const rows = await ThemeFilteredRank.find({ filterId }).populate("themeId", "name").sort({ rank: 1 }).lean();
  return rows.map((r) => ({
    themeId: String(r.themeId._id ?? r.themeId),
    themeName: (r.themeId as unknown as { name?: string })?.name ?? "",
    presetSlug: r.presetSlug,
    presetName: r.presetName,
    rank: r.rank,
    page: r.page,
    previousRank: r.previousRank,
  }));
}

/** Returns the last-crawled rows for a Sort/Collection combination — no live fetch, just what's stored. Read-only: a filter only starts being tracked (and re-crawled daily) once it's POSTed. */
export async function GET(request: Request) {
  const parsed = parseQuery(request);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await connectToDatabase();
  const { sortBy, industry } = parsed;

  const filter = await ThemeRankingFilter.findOne({ sortBy, industry }).lean<{ _id: unknown; sortBy: string; industry: string | null; lastCheckedAt?: Date | null; lastError?: string | null }>();
  if (!filter) return NextResponse.json({ filter: { sortBy, industry, lastCheckedAt: null, lastError: null }, rows: [] });
  const rows = await currentRows(filter._id);

  return NextResponse.json({
    filter: { sortBy: filter.sortBy, industry: filter.industry, lastCheckedAt: filter.lastCheckedAt, lastError: filter.lastError },
    rows,
  });
}

/** Runs a fresh crawl for this Sort/Collection combination (same on-request pattern as /api/themes/check-ranking) and returns the result. */
export async function POST(request: Request) {
  const parsed = parseQuery(request);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  await connectToDatabase();
  const { sortBy, industry } = parsed;

  const filter = await ThemeRankingFilter.findOneAndUpdate({ sortBy, industry }, {}, { upsert: true, new: true });
  const result = await runFilteredRankingCheck(filter);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  const rows = await currentRows(filter._id);

  return NextResponse.json({
    ok: true,
    filter: { sortBy: filter.sortBy, industry: filter.industry, lastCheckedAt: filter.lastCheckedAt, lastError: filter.lastError },
    rows,
  });
}
