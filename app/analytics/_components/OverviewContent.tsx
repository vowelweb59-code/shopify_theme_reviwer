"use client";

import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ErrorState } from "@/app/_components/ui/EmptyState";
import type { ThemeComparisonResponse, TrendsResponse } from "@/lib/analytics/engine/metrics";
import { DataNotes, DataWarnings } from "./DataNotices";
import { KpiCardSkeleton, KpiCards } from "./KpiCards";
import { MetaLine } from "./MetaLine";
import { ThemeComparison } from "./ThemeComparison";
import { Trends } from "./Trends";
import { useApi } from "./useApi";
import { useDashboardParams } from "./useDashboardParams";

export function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg border border-border-subtle bg-surface-muted ${className}`} aria-hidden />;
}

/**
 * The Overview page: KPI cards, trends and (for All Themes) the
 * theme comparison table. Two requests per selection change —
 * metrics/themes (KPI cards use its total row, the table its per-theme rows)
 * and metrics/trends. All figures come from the API; this only lays them out.
 */
export function OverviewContent() {
  const { params, setParams, apiQuery } = useDashboardParams();
  const comparison = useApi<ThemeComparisonResponse>(`/api/analytics/metrics/themes?${apiQuery}`);
  const trends = useApi<TrendsResponse>(`/api/analytics/metrics/trends?${apiQuery}`);

  const meta = comparison.data?.meta ?? null;
  const single = params.theme !== "all";
  const refreshing = Boolean(comparison.data) && (comparison.loading || trends.loading);

  if (comparison.error) {
    return (
      <ErrorState
        title="Couldn't load analytics"
        description={comparison.error}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={comparison.reload}>
              Try again
            </Button>
            {single && (
              <Button size="sm" variant="secondary" onClick={() => setParams({ theme: "all" })}>
                Show All Themes
              </Button>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={comparison.loading || trends.loading}>
      {meta && <MetaLine meta={meta} />}
      {meta && <DataWarnings meta={meta} />}

      {!comparison.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <KpiCards
          current={comparison.data.total.current}
          comparison={comparison.data.total.comparison}
          installsEstimated={comparison.data.meta.themes.some((t) => t.installsEstimated)}
        />
      )}

      <Card>
        <CardHeader title="Trends" description={params.compare ? "This period against the previous period, day by day." : "Day by day."} />
        {trends.error ? (
          <ErrorState
            title="Couldn't load trends"
            description={trends.error}
            action={
              <Button size="sm" variant="secondary" onClick={trends.reload}>
                Try again
              </Button>
            }
          />
        ) : trends.data ? (
          <Trends data={trends.data} />
        ) : (
          <Skeleton className="h-72" />
        )}
      </Card>

      {!single && (
        <Card>
          <CardHeader title="Theme comparison" description="Try Theme clicks and installs, by theme. Select a theme to see only its analytics." />
          {comparison.data ? <ThemeComparison
              rows={comparison.data.themes}
              estimatedInstalls={new Set(comparison.data.meta.themes.filter((t) => t.installsEstimated).map((t) => t.id))}
              onSelect={(slug) => setParams({ theme: slug })}
            /> : <Skeleton className="h-48" />}
        </Card>
      )}

      {meta && <DataNotes meta={meta} />}
    </div>
  );
}
