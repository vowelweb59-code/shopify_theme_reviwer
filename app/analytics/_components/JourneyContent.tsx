"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ErrorState } from "@/app/_components/ui/EmptyState";
import type { JourneyResponse } from "@/lib/analytics/engine/metrics";
import { DataNotes, DataWarnings } from "./DataNotices";
import { ChangeBadge } from "./KpiCards";
import { MetaLine } from "./MetaLine";
import { formatCount, formatPercent } from "./format";
import { useApi } from "./useApi";
import { useDashboardParams } from "./useDashboardParams";

const STEP_LABELS: Record<string, string> = {
  session_start: "Session",
  page_view: "Page View",
  view_item: "Theme View",
  add_to_cart: "Try Theme",
  shopify_theme_install: "Theme Install",
};

/**
 * Session → Page View → Theme View → Try Theme → Theme Install, shown as
 * five independent totals with the engine's step-to-step ratios. The "not
 * a sequence" caveat (the API's first note) goes up front rather than in
 * small print, because a funnel shape invites exactly that misreading.
 */
export function JourneyContent() {
  const { apiQuery } = useDashboardParams();
  const api = useApi<JourneyResponse>(`/api/analytics/metrics/journey?${apiQuery}`);

  if (api.error) {
    return (
      <ErrorState
        title="Couldn't load the journey"
        description={api.error}
        action={
          <Button size="sm" variant="secondary" onClick={api.reload}>
            Try again
          </Button>
        }
      />
    );
  }
  const data = api.data;
  const max = Math.max(1, ...(data?.steps.map((s) => s.users) ?? [1]));
  const [journeyNote, ...otherNotes] = data?.meta.notes ?? [];

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${data && api.loading ? "opacity-60" : ""}`} aria-busy={api.loading}>
      {data && <MetaLine meta={data.meta} />}
      {journeyNote && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-status-warning-bg p-3 text-sm text-status-warning-text dark:border-amber-900/50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-icon" aria-hidden />
          <p>{journeyNote}</p>
        </div>
      )}
      {data && <DataWarnings meta={data.meta} />}

      <Card>
        <CardHeader title="User journey" description="Users who fired each event in the period." />
        {!data ? (
          <div className="h-56 animate-pulse rounded-lg bg-surface-muted" aria-hidden />
        ) : (
          <div className="journey-chart flex flex-col gap-4">
            <style>{`
              .journey-chart { --bar: #2a78d6; }
              @media (prefers-color-scheme: dark) { .journey-chart { --bar: #3987e5; } }
            `}</style>
            {data.steps.map((s) => (
              <div key={s.eventName} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-200">
                    {STEP_LABELS[s.eventName] ?? s.eventName} <span className="font-mono text-xs text-zinc-400">{s.eventName}</span>
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium tabular-nums text-zinc-950 dark:text-zinc-50">{formatCount(s.users)} users</span>
                    <span className="text-xs text-zinc-500">{formatCount(s.count)} events</span>
                    {s.ofPrevious !== null && <span className="text-xs text-zinc-500">{formatPercent(s.ofPrevious)} of previous step</span>}
                    <ChangeBadge change={s.comparison?.users} />
                  </span>
                </div>
                <div className="h-6 w-full" title={`${formatCount(s.users)} users`}>
                  <div className="h-full min-w-[4px] rounded-r" style={{ width: `${(s.users / max) * 100}%`, backgroundColor: "var(--bar)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data && <DataNotes meta={{ ...data.meta, notes: otherNotes }} />}
    </div>
  );
}
