"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";

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
};
type Data = {
  rate: { workingDaysPerMonth: number; hoursPerMonth: number };
  totals: { cost: number; hours: number };
  missingSalary: { name: string; designation: string; hours: number }[];
  themes: ThemeRow[];
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n: number) => inr.format(n);
const dash = <span className="text-zinc-400">—</span>;
const amount = (n: number) => (n > 0 ? money(n) : dash);

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
  ];

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Theme cost</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          What each theme cost to make: every hour reported on it, priced at the reporter&apos;s own hourly cost (monthly salary / {data?.rate.hoursPerMonth ?? 221} h, which is{" "}
          {data?.rate.workingDaysPerMonth ?? 26} days of 8.5 h). Build is new-theme work, presets is preset work, updates is theme-update work. Product Managers are included at their own rate.
          Time on a round that was later rejected is in the total; reports don&apos;t say which round they belong to, so it can&apos;t be split out as rework.
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

          {current && (
            <Card>
              <CardHeader
                title={`${current.name}: who the cost is made of`}
                description={`${money(current.cost.total)} over ${current.hours.total} h${current.fixedDays > 0 ? `. Older projects also carry ${current.fixedDays} days entered by hand with no person, which are not priced.` : "."}`}
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
