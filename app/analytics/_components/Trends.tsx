"use client";

import { useState } from "react";
import { LineChart, type ChartSeries } from "@/app/themes/[themeId]/_components/LineChart";
import type { DailyMetrics } from "@/lib/analytics/engine/kpis";
import type { TrendsResponse } from "@/lib/analytics/engine/metrics";
import { dateToMs, formatCompact } from "./format";

type Basis = "users" | "events";

const METRICS: { key: "users" | "themeViews" | "tryTheme" | "installs"; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "themeViews", label: "Theme Views" },
  { key: "tryTheme", label: "Try Theme" },
  { key: "installs", label: "Theme Installs" },
];

function valueOf(day: DailyMetrics, key: (typeof METRICS)[number]["key"], basis: Basis): number {
  if (key === "users") return day.users;
  return basis === "users" ? day[key].users : day[key].count;
}

/**
 * One small chart per metric (small multiples, never a dual axis), each
 * showing this period and — when comparing — the previous period drawn on
 * the same days so the two lines overlay. A toggle switches the event
 * charts between daily unique users and raw event counts.
 */
export function Trends({ data }: { data: TrendsResponse }) {
  const [basis, setBasis] = useState<Basis>("users");
  const xs = data.dates.map(dateToMs);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show event trends as" className="inline-flex w-fit rounded-full border border-border-subtle p-0.5 text-xs">
        {(["users", "events"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={basis === b}
            onClick={() => setBasis(b)}
            className={`rounded-full px-3 py-1 font-medium ${basis === b ? "bg-primary-tint text-primary-tint-text" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {b === "users" ? "Unique users per day" : "Event count"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {METRICS.map((m) => {
          const series: ChartSeries[] = [{ key: "current", label: "This period", points: data.current.map((d, i) => ({ x: xs[i], y: valueOf(d, m.key, basis) })) }];
          if (data.previous) {
            series.push({ key: "previous", label: "Previous period", points: data.previous.map((d, i) => ({ x: xs[i], y: valueOf(d, m.key, basis) })) });
          }
          return (
            <div key={m.key} className="rounded-lg border border-border-subtle p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {m.label}
                {m.key !== "users" && <span className="ml-1 font-normal text-zinc-500">({basis === "users" ? "users" : "events"})</span>}
              </h4>
              <LineChart series={series} yTickFormat={formatCompact} yFloor={0} emptyMessage="No data for this range." />
            </div>
          );
        })}
      </div>
    </div>
  );
}
