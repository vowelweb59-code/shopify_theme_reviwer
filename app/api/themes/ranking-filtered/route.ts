import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ThemeRankingFilter } from "@/models/theme-ranking-filter";
import { ThemeFilteredRank } from "@/models/theme-filtered-rank";
import { runFilteredRankingCheck } from "@/lib/themes/runFilteredRankingCheck";

function parseQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortByRaw = searchParams.get("sortBy");
  const sortBy = sortByRaw === "newest" ? "newest" : "relevance";
  const industry = searchParams.get("industry") || null;
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

/** Returns the last-crawled rows for a Sort/Collection combination — no live fetch, just what's stored. Creates (and so starts tracking) the filter if it's new, with empty rows until a crawl runs. */
export async function GET(request: Request) {
  await connectToDatabase();
  const { sortBy, industry } = parseQuery(request);

  const filter = await ThemeRankingFilter.findOneAndUpdate({ sortBy, industry }, {}, { upsert: true, new: true });
  const rows = await currentRows(filter._id);

  return NextResponse.json({
    filter: { sortBy: filter.sortBy, industry: filter.industry, lastCheckedAt: filter.lastCheckedAt, lastError: filter.lastError },
    rows,
  });
}

/** Runs a fresh crawl for this Sort/Collection combination (same on-request pattern as /api/themes/check-ranking) and returns the result. */
export async function POST(request: Request) {
  await connectToDatabase();
  const { sortBy, industry } = parseQuery(request);

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
