"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { formatDateTime } from "@/app/_components/formatDate";
import { useApi } from "@/app/analytics/_components/useApi";

type Kind = "theme" | "preset" | "update" | null;
type Item = { work: string; kind: Kind; memo: string; minutes: number };
type Person = { name: string; designation: string | null; current: { work: string; kind: Kind; memo: string; postedAt: string | null } | null; today: Item[]; lastReportedOn: string | null; daysAgo: number | null };
type Data = { todayIst: string; people: Person[]; unmatched: Person[] };

const KIND_LABEL = { theme: "New theme", preset: "Preset", update: "Update" } as const;
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
const dash = <span className="text-zinc-400">—</span>;

function freshness(daysAgo: number | null) {
  if (daysAgo === null) return <span className="text-zinc-400">No report yet</span>;
  if (daysAgo <= 0) return <span className="font-medium text-status-pass-text">Today</span>;
  if (daysAgo === 1) return <span className="text-zinc-600 dark:text-zinc-400">Yesterday</span>;
  return <span className="text-zinc-500">{daysAgo} days ago</span>;
}

export default function CurrentWorkPage() {
  const { data, loading, error, reload } = useApi<Data>("/api/team-activity");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // The server reads the group every few minutes; this just re-reads what it has stored.
  useEffect(() => {
    const id = setInterval(reload, 60_000);
    return () => clearInterval(id);
  }, [reload]);

  async function refreshFromChat() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/chat/sync", { method: "POST" });
      if (!res.ok) setSyncError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't read the group.");
      reload();
    } catch {
      setSyncError("Lost connection to the server. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  const columns: TableColumn<Person>[] = [
    {
      key: "name",
      header: "Who",
      render: (p) => (
        <div>
          <div className="font-medium text-zinc-950 dark:text-zinc-50">{p.name}</div>
          {p.designation && <div className="text-xs text-zinc-500">{p.designation}</div>}
        </div>
      ),
      sortValue: (p) => p.name.toLowerCase(),
    },
    {
      key: "current",
      header: "Working on now",
      render: (p) =>
        p.current ? (
          <div>
            <div className="font-medium text-zinc-950 dark:text-zinc-50">
              {p.current.work}
              {p.current.kind && <span className="ml-1.5 rounded-full bg-primary-tint px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary-tint-text">{KIND_LABEL[p.current.kind]}</span>}
            </div>
            {p.current.memo && <div className="mt-0.5 max-w-xl text-xs text-zinc-500">{p.current.memo}</div>}
          </div>
        ) : (
          dash
        ),
      sortValue: (p) => p.current?.work.toLowerCase() ?? "~",
    },
    {
      key: "day",
      header: "Reported that day",
      render: (p) =>
        p.today.length > 1 ? (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{p.today.map((t) => `${t.work} (${hours(t.minutes)})`).join(", ")}</span>
        ) : p.today[0] ? (
          <span className="text-xs tabular-nums">{hours(p.today[0].minutes)}</span>
        ) : (
          dash
        ),
    },
    {
      key: "last",
      header: "Last report",
      render: (p) => (
        <div>
          {freshness(p.daysAgo)}
          {p.current?.postedAt ? <div className="text-xs text-zinc-500">{formatDateTime(p.current.postedAt)}</div> : p.lastReportedOn ? <div className="text-xs text-zinc-500">{p.lastReportedOn}</div> : null}
        </div>
      ),
      sortValue: (p) => p.daysAgo ?? 9999,
    },
  ];

  const reportedToday = data?.people.filter((p) => p.daysAgo !== null && p.daysAgo <= 0).length ?? 0;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Current Work</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            What each person is working on, from their latest report in the Theme Status Group. The group is read every 5 minutes, so a new report shows here shortly after it is posted.
            {data ? ` ${reportedToday} of ${data.people.length} have reported today.` : ""}
          </p>
        </div>
        <Button type="button" onClick={refreshFromChat} loading={syncing}>
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
          Refresh from Chat
        </Button>
      </div>

      {(error || syncError) && <p className="text-sm text-status-fail-text">{syncError ?? error}</p>}
      {loading && !data ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ResponsiveTable columns={columns} rows={data?.people ?? []} rowKey={(p) => p.name} theadClassName="bg-primary-tint text-primary-tint-text" emptyMessage="No team members yet." />
      )}

      {data && data.unmatched.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Posters not matched to a team member</h2>
          <p className="max-w-2xl text-sm text-zinc-500">Their reports are stored, but the name in the group matches nobody on the Team page. Add it as an alias of the right member and it moves up.</p>
          <ResponsiveTable columns={columns} rows={data.unmatched} rowKey={(p) => `u-${p.name}`} theadClassName="bg-primary-tint text-primary-tint-text" />
        </section>
      )}
    </PageContainer>
  );
}
