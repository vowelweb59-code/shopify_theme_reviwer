"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";
import { ProjectStatusPill } from "@/app/projects/_components/ProjectStatusPill";
import { PROJECT_TYPE_LABELS, type ProjectStatus, type ProjectType } from "@/lib/projects/constants";
import type { DeadlineInfo } from "@/lib/projects/deadlines";

type Row = DeadlineInfo & {
  _id: string;
  name: string;
  themeName: string | null;
  portal: string | null;
  type: ProjectType;
  status: ProjectStatus | null;
  deadline: string | null;
  lastReportOn: string | null;
};
type Data = { today: string; projects: Row[] };
type Filter = "all" | "open" | "finished";

// "2026-10-29" -> "Oct 29, 2026"; the stored day is a calendar date, so no time zone shift.
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const dash = <span className="text-zinc-400">—</span>;

function stateLabel(r: Row) {
  switch (r.state) {
    case "overdue":
      return <span className="font-medium text-status-fail-text">Overdue by {plural(-(r.daysLeft ?? 0))}</span>;
    case "due_soon":
      return <span className="font-medium text-status-warning-text">{r.daysLeft === 0 ? "Due today" : `Due in ${plural(r.daysLeft ?? 0)}`}</span>;
    case "on_track":
      return <span className="text-zinc-600 dark:text-zinc-400">{plural(r.daysLeft ?? 0)} left</span>;
    case "finished":
      return r.lateByDays ? <span className="text-status-fail-text">Finished {plural(r.lateByDays)} late</span> : <span className="font-medium text-status-pass-text">{r.deadline ? "Finished on time" : "Finished"}</span>;
    default:
      return <span className="text-zinc-400">No deadline set</span>;
  }
}

const INPUT = "rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm";

export default function DeadlinesPage() {
  const { data, loading, error, reload } = useApi<Data>("/api/deadlines");
  const [filter, setFilter] = useState<Filter>("open");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveDeadline(id: string, deadline: string) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deadline }) });
      if (!res.ok) setSaveError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save the deadline.");
    } catch {
      setSaveError("Lost connection to the server. Try again.");
    }
    reload();
  }

  const rows = useMemo(() => {
    const all = data?.projects ?? [];
    const shown = all.filter((r) => filter === "all" || (filter === "finished") === (r.state === "finished"));
    // Open work by date (overdue first, no deadline last), then what's finished, latest first.
    const rank = (r: Row) => (r.state === "finished" ? 2 : r.date ? 0 : 1);
    return [...shown].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? (b.date ?? "").localeCompare(a.date ?? "") : (a.date ?? "").localeCompare(b.date ?? "")));
  }, [data, filter]);

  const overdue = data?.projects.filter((r) => r.state === "overdue").length ?? 0;
  const dueSoon = data?.projects.filter((r) => r.state === "due_soon").length ?? 0;

  const columns: TableColumn<Row>[] = [
    {
      key: "project",
      header: "Project",
      render: (r) => (
        <div>
          <Link href={`/projects/${r._id}`} className="font-medium text-zinc-950 hover:underline dark:text-zinc-50">
            {r.name}
          </Link>
          <div className="text-xs text-zinc-500">{[r.themeName, PROJECT_TYPE_LABELS[r.type], r.portal].filter(Boolean).join(" · ")}</div>
        </div>
      ),
      sortValue: (r) => r.name.toLowerCase(),
    },
    { key: "status", header: "Status", render: (r) => (r.status ? <ProjectStatusPill status={r.status} /> : dash), sortValue: (r) => r.status ?? "" },
    {
      key: "deadline",
      header: "Deadline",
      render: (r) =>
        r.state === "finished" ? (
          <div>
            {r.date ? <span className="tabular-nums">{day(r.date)}</span> : <span className="text-zinc-400">No report yet</span>}
            <div className="text-xs text-zinc-500">{r.date ? "last report" : ""}{r.deadline ? `${r.date ? " · " : ""}due ${day(r.deadline)}` : ""}</div>
          </div>
        ) : (
          <input type="date" aria-label={`Deadline for ${r.name}`} className={INPUT} defaultValue={r.deadline ?? ""} key={r.deadline ?? "none"} onBlur={(e) => e.target.value !== (r.deadline ?? "") && saveDeadline(r._id, e.target.value)} />
        ),
      sortValue: (r) => r.date ?? "~",
    },
    { key: "state", header: "Timing", render: stateLabel, sortValue: (r) => (r.daysLeft ?? 99999) },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Deadlines</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            When each project is due. Pick a date to set or change it. Once a project is Live or Completed, its last report date is shown instead.
            {data ? ` ${overdue} overdue, ${dueSoon} due within a week.` : ""}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Show
          <select className={INPUT} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="open">Open projects</option>
            <option value="finished">Finished projects</option>
            <option value="all">All projects</option>
          </select>
        </label>
      </div>

      {(error || saveError) && <p className="text-sm text-status-fail-text">{saveError ?? error}</p>}
      {loading && !data ? <p className="text-sm text-zinc-500">Loading…</p> : <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r._id} theadClassName="bg-primary-tint text-primary-tint-text" emptyMessage="No projects here." />}
    </PageContainer>
  );
}
