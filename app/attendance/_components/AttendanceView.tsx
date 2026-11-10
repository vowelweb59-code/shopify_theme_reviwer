"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/app/_components/formatDate";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";

type Source = "upwork" | "theme";
type Status = "reported" | "leave" | "half-leave" | "leave-but-reported" | "missing" | "saturday" | "sunday" | "pending" | "inactive";
type Leave = { half: boolean; reason: string | null };
type Cell = { day: string; status: Status; reportedIn: Source[]; leave: Leave | null };
type Row = { key: string; name: string; sources: Source[]; cells: Cell[]; counts: { reported: number; leave: number; missing: number; conflicts: number } };
type Flag = { key: string; name: string; day: string; kind: "missing" | "leave-but-reported"; expectedIn: Source[]; reportedIn: Source[]; leave: Leave | null };
type Report = {
  month: string;
  days: string[];
  today: string;
  rows: Row[];
  flags: Flag[];
  summary: { people: number; flags: number; missing: number; conflicts: number; announcements: number; messages: number };
  unmatched: { person: string; dates: string[]; postedAt: string }[];
  review: { postedAt: string; text: string; why: string }[];
  sync: { lastSyncAt: string | null; lastCount: number; lastError: string | null } | null;
};

const SOURCE_LABEL: Record<Source, string> = { upwork: "Upwork", theme: "the theme team" };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (day: string) => WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()];
const dayLabel = (day: string) => `${weekday(day)} ${day.slice(8)} ${new Date(`${day}T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
const list = (xs: Source[]) => xs.map((s) => SOURCE_LABEL[s]).join(" or ");

const CELL: Record<Status, { mark: string; cls: string; hint: string }> = {
  reported: { mark: "✓", cls: "bg-status-pass-bg text-status-pass-text", hint: "Reported" },
  leave: { mark: "L", cls: "bg-primary-tint text-primary", hint: "On leave" },
  "half-leave": { mark: "½", cls: "bg-status-pass-bg text-status-pass-text", hint: "Half-day leave, reported" },
  "leave-but-reported": { mark: "!", cls: "bg-status-warning-bg text-status-warning-text", hint: "Leave announced but hours reported" },
  missing: { mark: "✗", cls: "bg-status-fail-bg text-status-fail-text font-semibold", hint: "No report, no leave announced" },
  saturday: { mark: "", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900", hint: "Saturday (flexible)" },
  sunday: { mark: "", cls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900", hint: "Sunday" },
  pending: { mark: "·", cls: "text-zinc-400", hint: "Today or later: not due yet" },
  inactive: { mark: "", cls: "text-zinc-300", hint: "Not on the team that day (before the first report, or 30 days after the last)" },
};

function problem(f: Flag): string {
  if (f.kind === "leave-but-reported") return `Leave announced${f.leave?.reason ? ` (${f.leave.reason})` : ""} but hours were reported in ${list(f.reportedIn)}.`;
  return `No report in ${list(f.expectedIn)} and no leave announced.`;
}

export function AttendanceView({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState<"" | Flag["kind"]>("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi<Report>(`/api/attendance?month=${encodeURIComponent(month)}`);

  async function sync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: 3 }) });
      const body = (await res.json().catch(() => null)) as { fetched?: number; error?: string } | null;
      setMessage(res.ok ? `Read ${body?.fetched ?? 0} messages.` : (body?.error ?? "Couldn't read the attendance space."));
      reload();
    } finally {
      setSyncing(false);
    }
  }

  const flags = useMemo(() => (data?.flags ?? []).filter((f) => (!person || f.key === person) && (!kind || f.kind === kind)), [data, person, kind]);
  const columns: TableColumn<Flag>[] = [
    { key: "day", header: "Day", render: (f) => <span className="whitespace-nowrap font-medium tabular-nums">{dayLabel(f.day)}</span>, sortValue: (f) => f.day },
    { key: "name", header: "Person", render: (f) => <span>{f.name}</span>, sortValue: (f) => f.name.toLowerCase() },
    {
      key: "kind",
      header: "Flag",
      render: (f) => <span className={f.kind === "missing" ? "text-status-fail-text" : "text-status-warning-text"}>{f.kind === "missing" ? "Missing" : "Leave but reported"}</span>,
      sortValue: (f) => f.kind,
    },
    { key: "why", header: "What is missing", render: (f) => <span className="text-sm">{problem(f)}</span> },
  ];

  const select = "rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm";
  const none = data && data.summary.messages === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Month
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={select} aria-label="Month" />
        </label>
        <Button type="button" onClick={sync} disabled={syncing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
          {syncing ? "Reading…" : "Read attendance space now"}
        </Button>
        {data?.sync?.lastSyncAt && <span className="text-xs text-zinc-500">Space last read {formatDateTime(data.sync.lastSyncAt)} ({data.sync.lastCount} messages)</span>}
      </div>
      {message && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
      {(error || data?.sync?.lastError) && <p role="alert" className="text-sm text-status-fail-text">{error ?? `Last read failed: ${data?.sync?.lastError}`}</p>}
      {loading && !data && <p className="text-sm text-zinc-500">Loading…</p>}
      {none && (
        <p className="rounded-md bg-status-warning-bg p-3 text-sm text-status-warning-text">
          No leave announcements have been read yet, so every working day without a report would be flagged. Connect Google Chat on Service &gt; Chat sync (the account must be a
          member of the attendance space), then press “Read attendance space now”.
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["People checked", data.summary.people, ""],
              ["Days missing a report", data.summary.missing, data.summary.missing ? "text-status-fail-text" : ""],
              ["Leave but reported", data.summary.conflicts, data.summary.conflicts ? "text-status-warning-text" : ""],
              ["Leave announcements read", data.summary.announcements, ""],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-lg border border-border-subtle p-3">
                <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
                <div className="text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader title="Flags" description="Every working day that needs a look, oldest first." />
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person" className={select}>
                <option value="">Everyone</option>
                {data.rows.filter((r) => r.counts.missing + r.counts.conflicts > 0).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name} ({r.counts.missing + r.counts.conflicts})
                  </option>
                ))}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value as "" | Flag["kind"])} aria-label="Flag type" className={select}>
                <option value="">All flags</option>
                <option value="missing">Missing report</option>
                <option value="leave-but-reported">Leave but reported</option>
              </select>
              <span className="text-xs text-zinc-500">{flags.length} shown</span>
            </div>
            <ResponsiveTable columns={columns} rows={flags} rowKey={(f) => `${f.key}|${f.day}|${f.kind}`} pageSize={25} emptyMessage="Nothing flagged for this month." />
          </Card>

          <Card>
            <CardHeader title="Month at a glance" description="✓ reported · L leave · ½ half-day leave · ✗ missing · ! leave but reported · shaded = Saturday / Sunday · · not due yet" />
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface px-2 py-1 text-left font-medium">Person</th>
                    {data.days.map((d) => (
                      <th key={d} className="px-0.5 py-1 text-center font-normal text-zinc-500" title={dayLabel(d)}>
                        <div>{weekday(d).slice(0, 1)}</div>
                        <div className="tabular-nums">{d.slice(8)}</div>
                      </th>
                    ))}
                    <th className="px-2 py-1 text-right font-medium">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.key}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-0.5 text-left" title={`Reports in ${list(r.sources)}`}>
                        {r.name}
                      </td>
                      {r.cells.map((c) => {
                        const s = CELL[c.status];
                        const tip = `${r.name}, ${dayLabel(c.day)}: ${s.hint}${c.reportedIn.length ? ` (${list(c.reportedIn)})` : ""}${c.leave?.reason ? `. Leave: ${c.leave.reason}` : ""}`;
                        return (
                          <td key={c.day} title={tip} className={`h-6 w-6 min-w-6 border border-surface text-center ${s.cls}`}>
                            {c.status === "saturday" && c.reportedIn.length > 0 ? "✓" : s.mark}
                          </td>
                        );
                      })}
                      <td className="px-2 py-0.5 text-right tabular-nums">{r.counts.missing + r.counts.conflicts || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.rows.length === 0 && <p className="text-sm text-zinc-500">No one has reported in Upwork or the theme team around this month.</p>}
          </Card>

          {data.unmatched.length > 0 && (
            <Card>
              <CardHeader title="Leaves for names not found" description="The announcement names someone who has no reports in Upwork or the theme team. Check the spelling, or add the spelling as an alias on the Team page." />
              <ul className="space-y-1 text-sm">
                {data.unmatched.map((u, i) => (
                  <li key={i}>
                    <span className="font-medium">{u.person}</span> · {u.dates.join(", ")} <span className="text-xs text-zinc-500">(posted {formatDateTime(u.postedAt)})</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.review.length > 0 && (
            <Card>
              <CardHeader title="Messages I couldn't read" description="Leave-style posts without a usable date. Days they cover show as missing until the wording is understood; send me these." />
              <ul className="space-y-2 text-sm">
                {data.review.map((m, i) => (
                  <li key={i}>
                    <div className="text-xs text-zinc-500">
                      {formatDateTime(m.postedAt)} · {m.why}
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
