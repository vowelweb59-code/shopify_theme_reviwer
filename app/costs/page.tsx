"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";
import { Button } from "@/app/_components/ui/Button";
import { csvCell as cell } from "@/lib/export/csvUtil";

type Lines = { build: number; presets: number; updates: number; total: number };
type PersonRow = { memberId: string; name: string; designation: string; hours: number; cost: number | null; byLine: { build: number; presets: number; updates: number } };
type ThemeRow = {
  themeId: string;
  name: string;
  live: boolean;
  cost: Lines;
  hours: Lines;
  unpricedHours: number;
  people: PersonRow[];
  rejections: number;
  fixedDays: number;
  byMonth: { month: string; cost: number; hours: number }[];
  rework: { from: string; cost: number; hours: number } | null;
};
type Data = {
  rate: { workingDaysPerMonth: number; hoursPerMonth: number };
  totals: { cost: number; hours: number };
  months: { month: string; cost: number; hours: number }[];
  missingSalary: { name: string; designation: string; hours: number }[];
  themes: ThemeRow[];
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n: number) => inr.format(n);
/** "2026-10" -> "Oct 2026" (a calendar month, no time zone shift). */
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
const dash = <span className="text-zinc-400">—</span>;
const amount = (n: number) => (n > 0 ? money(n) : dash);

/** Builds and downloads a CSV in the browser (cells go through csvCell: quoted, formula-guarded; amounts are plain INR numbers). */
function download(name: string, header: string[], rows: (string | number | null)[][]) {
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // The BOM makes Excel read the file as UTF-8 (theme and people names with accents).
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** One row per theme: the lines, totals, hours, rework, and the cost of each month as its own column. */
function exportThemes(data: Data) {
  const months = data.months.map((m) => m.month);
  const header = ["Theme", "Status", "Build (INR)", "Presets (INR)", "Updates (INR)", "Total cost (INR)", "Hours", "Hours not priced", "Rejections", "First rejection", "Rework (INR)", "Rework hours", ...months.map((m) => `${m} (INR)`)];
  const rows = data.themes.map((t) => {
    const byMonth = new Map(t.byMonth.map((m) => [m.month, m.cost]));
    return [
      t.name,
      t.live ? "Live" : "Under development",
      t.cost.build,
      t.cost.presets,
      t.cost.updates,
      t.cost.total,
      t.hours.total,
      t.unpricedHours,
      t.rejections,
      t.rework?.from ?? "",
      t.rework ? t.rework.cost : "",
      t.rework ? t.rework.hours : "",
      ...months.map((m) => byMonth.get(m) ?? 0),
    ];
  });
  rows.push(["All themes", "", ...(["build", "presets", "updates", "total"] as const).map((k) => data.themes.reduce((n, t) => n + t.cost[k], 0)), data.totals.hours, data.themes.reduce((n, t) => Math.round((n + t.unpricedHours) * 10) / 10, 0), data.themes.reduce((n, t) => n + t.rejections, 0), "", "", "", ...data.months.map((m) => m.cost)]);
  download(`theme-cost-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
}

/** One row per theme and person: hours by kind of work and the cost (empty when the person has no salary entered). */
function exportPeople(data: Data) {
  const header = ["Theme", "Person", "Designation", "Build hours", "Preset hours", "Update hours", "Hours", "Cost (INR)"];
  const rows = data.themes.flatMap((t) => t.people.map((p) => [t.name, p.name, p.designation, p.byLine.build, p.byLine.presets, p.byLine.updates, p.hours, p.cost ?? ""]));
  download(`theme-cost-by-person-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
}

export default function CostsPage() {
  const { data, loading, error } = useApi<Data>("/api/costs");
  const [selected, setSelected] = useState<string | null>(null);
  const current = useMemo(() => data?.themes.find((t) => t.themeId === selected) ?? null, [data, selected]);

  const columns: TableColumn<ThemeRow>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (t) => (
        <div>
          <span className="font-medium text-zinc-950 dark:text-zinc-50">{t.name}</span>
          {!t.live && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Under development</span>}
        </div>
      ),
      sortValue: (t) => t.name.toLowerCase(),
    },
    { key: "build", header: "Build", render: (t) => amount(t.cost.build), sortValue: (t) => t.cost.build },
    { key: "presets", header: "Presets", render: (t) => amount(t.cost.presets), sortValue: (t) => t.cost.presets },
    { key: "updates", header: "Updates", render: (t) => amount(t.cost.updates), sortValue: (t) => t.cost.updates },
    { key: "total", header: "Total cost", render: (t) => <span className="font-semibold tabular-nums">{money(t.cost.total)}</span>, sortValue: (t) => t.cost.total },
    {
      key: "hours",
      header: "Hours",
      render: (t) => (
        <span className="tabular-nums">
          {t.hours.total} h
          {t.unpricedHours > 0 && <span className="block text-xs text-status-warning-text">{t.unpricedHours} h not priced</span>}
        </span>
      ),
      sortValue: (t) => t.hours.total,
    },
    { key: "rejections", header: "Rejections", render: (t) => t.rejections, sortValue: (t) => t.rejections },
    {
      key: "rework",
      header: "Rework",
      render: (t) =>
        t.rework ? (
          <span className="tabular-nums" title={`Build work after the first rejection on ${t.rework.from}: ${t.rework.hours} h (already inside Build)`}>
            {t.rework.cost > 0 ? money(t.rework.cost) : `${t.rework.hours} h`}
            <span className="block text-xs text-zinc-500">after {t.rework.from}</span>
          </span>
        ) : t.rejections > 0 ? (
          <span className="text-xs text-zinc-400">no date</span>
        ) : (
          dash
        ),
      sortValue: (t) => t.rework?.cost ?? -1,
    },
  ];

  return (
    <PageContainer>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Theme cost</h1>
          {data && data.themes.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => exportThemes(data)}>
                Export CSV
              </Button>
              <Button size="sm" variant="secondary" onClick={() => exportPeople(data)}>
                Export by person
              </Button>
            </div>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          What each theme cost to make: every hour reported on it, priced at the reporter&apos;s own hourly cost (monthly salary / {data?.rate.hoursPerMonth ?? 221} h, which is{" "}
          {data?.rate.workingDaysPerMonth ?? 26} days of 8.5 h). Build is new-theme work, presets is preset work, updates is theme-update work. Product Managers are included at their own rate.
          Rework is the build work done after the theme&apos;s first rejection: enter the date in “Rejected on” on the project page (and on each earlier round) and it appears here. It is part of Build, not added on top.
        </p>
      </div>

      {(error || (loading && !data)) && <p className={`text-sm ${error ? "text-status-fail-text" : "text-zinc-500"}`}>{error ?? "Loading…"}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border-subtle p-3">
              <div className="text-xs text-zinc-500">All themes</div>
              <div className="text-xl font-semibold tabular-nums">{money(data.totals.cost)}</div>
            </div>
            <div className="rounded-lg border border-border-subtle p-3">
              <div className="text-xs text-zinc-500">Hours reported</div>
              <div className="text-xl font-semibold tabular-nums">{data.totals.hours} h</div>
            </div>
            <div className="rounded-lg border border-border-subtle p-3">
              <div className="text-xs text-zinc-500">Themes with cost</div>
              <div className="text-xl font-semibold tabular-nums">{data.themes.filter((t) => t.cost.total > 0).length}</div>
            </div>
          </div>

          {data.missingSalary.length > 0 && (
            <div className="rounded-md border border-status-warning-bg bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
              No salary is entered for {data.missingSalary.map((p) => `${p.name} (${p.hours} h)`).join(", ")}, so those hours are counted but not priced and the costs below are
              lower than they really are. Add the salaries on the <Link href="/team" className="underline">Team</Link> page.
            </div>
          )}

          <ResponsiveTable
            columns={columns}
            rows={data.themes}
            rowKey={(t) => t.themeId}
            onRowClick={(t) => setSelected(t.themeId === selected ? null : t.themeId)}
            theadClassName="bg-primary-tint text-primary-tint-text"
            emptyMessage="No hours have been reported on any theme yet."
          />

          {data.months.length > 0 && (
            <Card>
              <CardHeader title="Cost by month" description="What was worked each month, priced the same way: the month a report's day falls in. Newest month last." />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="sticky left-0 bg-surface py-1 pr-4 font-medium">Theme</th>
                      {data.months.map((m) => (
                        <th key={m.month} className="whitespace-nowrap py-1 pr-4 text-right font-medium">
                          {monthLabel(m.month)}
                        </th>
                      ))}
                      <th className="whitespace-nowrap py-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.themes
                      .filter((t) => t.byMonth.length > 0)
                      .map((t) => {
                        const byMonth = new Map(t.byMonth.map((m) => [m.month, m]));
                        return (
                          <tr key={t.themeId} className="border-t border-border-subtle">
                            <td className="sticky left-0 bg-surface py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">{t.name}</td>
                            {data.months.map((m) => {
                              const cell = byMonth.get(m.month);
                              return (
                                <td key={m.month} className="whitespace-nowrap py-2 pr-4 text-right tabular-nums" title={cell ? `${cell.hours} h` : undefined}>
                                  {cell && cell.cost > 0 ? money(cell.cost) : cell ? <span className="text-zinc-400">{cell.hours} h</span> : dash}
                                </td>
                              );
                            })}
                            <td className="whitespace-nowrap py-2 text-right font-semibold tabular-nums">{money(t.cost.total)}</td>
                          </tr>
                        );
                      })}
                    <tr className="border-t-2 border-border-subtle font-semibold">
                      <td className="sticky left-0 bg-surface py-2 pr-4">All themes</td>
                      {data.months.map((m) => (
                        <td key={m.month} className="whitespace-nowrap py-2 pr-4 text-right tabular-nums" title={`${m.hours} h`}>
                          {money(m.cost)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap py-2 text-right tabular-nums">{money(data.totals.cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-500">A grey “N h” means hours were reported that month but nobody on them has a salary entered yet. Hover a cell for the hours.</p>
            </Card>
          )}

          {current && (
            <Card>
              <CardHeader
                title={`${current.name}: who the cost is made of`}
                description={`${money(current.cost.total)} over ${current.hours.total} h${current.rework ? `, of which ${money(current.rework.cost)} (${current.rework.hours} h) is build rework after the first rejection on ${current.rework.from}` : ""}${current.fixedDays > 0 ? `. Older projects also carry ${current.fixedDays} days entered by hand with no person, which are not priced.` : "."}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="py-1 pr-3 font-medium">Person</th>
                      <th className="py-1 pr-3 font-medium">Build (h)</th>
                      <th className="py-1 pr-3 font-medium">Presets (h)</th>
                      <th className="py-1 pr-3 font-medium">Updates (h)</th>
                      <th className="py-1 pr-3 font-medium">Hours</th>
                      <th className="py-1 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.people.map((p) => (
                      <tr key={p.memberId} className="border-t border-border-subtle">
                        <td className="py-2 pr-3">
                          {p.name} <span className="text-xs text-zinc-500">{p.designation}</span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{p.byLine.build || dash}</td>
                        <td className="py-2 pr-3 tabular-nums">{p.byLine.presets || dash}</td>
                        <td className="py-2 pr-3 tabular-nums">{p.byLine.updates || dash}</td>
                        <td className="py-2 pr-3 tabular-nums">{p.hours}</td>
                        <td className="py-2 tabular-nums">{p.cost === null ? <span className="text-status-warning-text">no salary</span> : money(p.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <p className="text-xs text-zinc-500">Click a theme to see the people behind its cost.</p>
        </>
      )}
    </PageContainer>
  );
}
