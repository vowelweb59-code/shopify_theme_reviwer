"use client";

import { use, useEffect, useState } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Breadcrumbs } from "@/app/_components/shell/Breadcrumbs";
import { LineChart, type ChartSeries } from "../_components/LineChart";

type HistoryData = {
  theme: { name: string; slug: string | null };
  rankSeries: { slug: string; name: string; points: { date: string; rank: number; page: number | null }[] }[];
  reviewSeries: { date: string; reviewCount: number; positivePercent: number | null }[];
};

export default function ThemeRankingHistoryPage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = use(params);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/themes/${themeId}/history`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [themeId]);

  const rankChartSeries: ChartSeries[] =
    data?.rankSeries.map((s) => ({
      key: s.slug,
      label: s.name,
      points: s.points.map((p) => ({ x: new Date(p.date).getTime(), y: p.rank })),
    })) ?? [];

  const reviewChartSeries: ChartSeries[] = data
    ? [
        {
          key: "reviews",
          label: "Reviews",
          points: data.reviewSeries.map((p) => ({ x: new Date(p.date).getTime(), y: p.reviewCount })),
        },
      ]
    : [];

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Themes", href: "/themes" }, { label: data?.theme.name ?? "…", href: `/themes/${themeId}` }, { label: "Ranking" }]} />

      <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{data?.theme.name ?? "Theme"} — Ranking History</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Every catalog position recorded for this theme and each of its named presets, one line per listing. Built from every past{" "}
        &quot;Check Ranking&quot; crawl — a new point is added each time, so this fills in over time rather than showing history from before
        tracking started.
      </p>

      {loading && <p className="mt-6 text-sm text-zinc-500">Loading…</p>}

      {!loading && data && (
        <div className="mt-6 flex flex-col gap-8">
          <section>
            <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Ranking Changes</h2>
            <p className="mb-3 text-xs text-zinc-500">Lower is better — a line moving up the chart means the listing climbed the catalog.</p>
            <LineChart
              series={rankChartSeries}
              invertY
              yTickFormat={(v) => `#${Math.round(v)}`}
              emptyMessage="No ranking history yet — run Check Ranking on /demo-store to start recording it."
            />
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Review Changes</h2>
            <p className="mb-3 text-xs text-zinc-500">Total review count on the theme&apos;s own listing (shared by all its presets).</p>
            <LineChart
              series={reviewChartSeries}
              emptyMessage="No review history yet — run Check Theme Store on this theme to start recording it."
            />
          </section>
        </div>
      )}
    </PageContainer>
  );
}
