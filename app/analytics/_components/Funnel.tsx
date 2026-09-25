"use client";

import { useState } from "react";
import type { KpiSet } from "@/lib/analytics/engine/kpis";
import { formatCount, formatPercent } from "./format";

/**
 * Users → Theme Views → Try Theme → Theme Installs, as horizontal bars
 * scaled to Users. One series, so one hue (the chart palette's first slot,
 * same token as the app's LineChart). Each step's rate is the engine's
 * aggregate ratio of the two steps' users — shown as "÷ previous step",
 * not "converted", because the data doesn't follow people from one step to
 * the next (see the note under the chart).
 */
export function Funnel({ kpis }: { kpis: KpiSet }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const steps = [
    { label: "Users", users: kpis.users, rate: null as number | null, rateLabel: "" },
    { label: "Theme Views", users: kpis.themeViews.users, rate: kpis.rates.themeViewRate, rateLabel: "of users" },
    { label: "Try Theme", users: kpis.tryTheme.users, rate: kpis.rates.viewToTryTheme, rateLabel: "÷ theme views" },
    { label: "Theme Installs", users: kpis.installs.users, rate: kpis.rates.tryThemeToInstall, rateLabel: "÷ Try Theme" },
  ];
  const max = Math.max(1, ...steps.map((s) => s.users));

  return (
    <div className="funnel-chart flex flex-col gap-4" onMouseLeave={() => setHovered(null)}>
      <style>{`
        .funnel-chart { --bar: #2a78d6; }
        @media (prefers-color-scheme: dark) { .funnel-chart { --bar: #3987e5; } }
      `}</style>
      {steps.map((s, i) => (
        // Label and figures above, bar in its own full-width track below, so
        // bar lengths stay proportional at any width (text never squeezes them).
        <div key={s.label} className="relative flex flex-col gap-1" onMouseEnter={() => setHovered(i)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">{s.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-medium tabular-nums text-zinc-950 dark:text-zinc-50">{formatCount(s.users)}</span>
              {s.rate !== null && (
                <span className="text-xs text-zinc-500">
                  {formatPercent(s.rate)} {s.rateLabel}
                </span>
              )}
            </span>
          </div>
          <div className="h-6 w-full">
            <div
              className="h-full min-w-[4px] rounded-r transition-opacity"
              style={{ width: `${(s.users / max) * 100}%`, backgroundColor: "var(--bar)", opacity: hovered === null || hovered === i ? 1 : 0.45 }}
            />
          </div>
          {hovered === i && (
            <div role="tooltip" className="pointer-events-none absolute -top-8 left-0 z-10 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-xs shadow-md">
              <span className="font-medium text-zinc-950 dark:text-zinc-50">{s.label}</span>
              <span className="text-zinc-500"> · {formatCount(s.users)} users</span>
              {s.rate !== null && (
                <span className="text-zinc-500">
                  {" "}
                  · {formatPercent(s.rate, 2)} {s.rateLabel}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
