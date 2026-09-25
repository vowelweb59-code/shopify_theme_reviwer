"use client";

import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ErrorState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import type { EventSummaryResponse, EventSummaryRow } from "@/lib/analytics/engine/metrics";
import { DataNotes, DataWarnings } from "./DataNotices";
import { eventLabel } from "./FilterBar";
import { ChangeBadge, KpiCard, KpiCardSkeleton } from "./KpiCards";
import { MetaLine } from "./MetaLine";
import { formatCount } from "./format";
import { useApi } from "./useApi";
import { useDashboardParams } from "./useDashboardParams";

/**
 * Every tracked event. The two primary events (and Theme View) lead as
 * cards; the supporting events follow in a compact table for context, so
 * generic activity like page_view or scroll never dominates the page.
 */
export function EventsContent() {
  const { params, apiQuery } = useDashboardParams();
  const api = useApi<EventSummaryResponse>(`/api/analytics/metrics/events?${apiQuery}`);

  if (api.error) {
    return (
      <ErrorState
        title="Couldn't load events"
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
  const lead = data?.events.filter((e) => e.role !== "supporting") ?? [];
  const supporting = data?.events.filter((e) => e.role === "supporting") ?? [];

  const columns: TableColumn<EventSummaryRow>[] = [
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className={`font-mono text-xs ${r.eventName === params.event ? "font-semibold text-primary" : ""}`}>
          {r.eventName}
          {r.eventName === params.event && <span className="ml-1.5 font-sans text-[10px] uppercase">selected</span>}
        </span>
      ),
      sortValue: (r) => r.eventName,
    },
    {
      key: "users",
      header: "Users",
      className: "text-right",
      render: (r) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span className="tabular-nums">{formatCount(r.users.current)}</span>
          <ChangeBadge change={r.users} />
        </span>
      ),
      sortValue: (r) => r.users.current ?? 0,
    },
    {
      key: "count",
      header: "Event count",
      className: "text-right",
      render: (r) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span className="tabular-nums">{formatCount(r.count.current)}</span>
          <ChangeBadge change={r.count} />
        </span>
      ),
      sortValue: (r) => r.count.current ?? 0,
    },
  ];

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${data && api.loading ? "opacity-60" : ""}`} aria-busy={api.loading}>
      {data && <MetaLine meta={data.meta} />}
      {data && <DataWarnings meta={data.meta} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data
          ? lead.map((e) => (
              <KpiCard
                key={e.eventName}
                label={eventLabel(e.eventName)}
                value={formatCount(e.users.current)}
                detail={`${formatCount(e.count.current)} events · ${e.eventName}`}
                change={e.users}
                emphasis={e.role === "primary"}
              />
            ))
          : Array.from({ length: 3 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>

      <Card>
        <CardHeader title="Supporting events" description="Context around the primary events. Users are unique per event; counts are total firings." />
        {data ? (
          <ResponsiveTable columns={columns} rows={supporting} rowKey={(r) => r.eventName} emptyMessage="No supporting events recorded." />
        ) : (
          <div className="h-64 animate-pulse rounded-lg border border-border-subtle bg-surface-muted" aria-hidden />
        )}
      </Card>

      {data && <DataNotes meta={data.meta} />}
    </div>
  );
}
