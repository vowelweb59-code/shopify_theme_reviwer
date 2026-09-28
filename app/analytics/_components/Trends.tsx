"use client";

import { LineChart, type ChartSeries } from "@/app/themes/[themeId]/_components/LineChart";
import type { TrendsResponse } from "@/lib/analytics/engine/metrics";
import { dateToMs, formatCompact } from "./format";

const METRICS = [
  { key: "tryTheme", label: "Try Theme clicks" },
  { key: "installs", label: "Theme Installs" },
] as const;

/**
 * One small chart per metric (small multiples, never a dual axis), each
 * showing this period and — when comparing — the previous period drawn on
 * the same days so the two lines overlay.
 */
export function Trends({ data }: { data: TrendsResponse }) {
  const xs = data.dates.map(dateToMs);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {METRICS.map((m) => {
        const series: ChartSeries[] = [{ key: "current", label: "This period", points: data.current.map((d, i) => ({ x: xs[i], y: d[m.key] })) }];
        if (data.previous) {
          series.push({ key: "previous", label: "Previous period", points: data.previous.map((d, i) => ({ x: xs[i], y: d[m.key] })) });
        }
        return (
          <div key={m.key} className="rounded-lg border border-border-subtle p-4">
            <h4 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{m.label}</h4>
            <LineChart series={series} yTickFormat={formatCompact} yFloor={0} emptyMessage="No data for this range." />
          </div>
        );
      })}
    </div>
  );
}
