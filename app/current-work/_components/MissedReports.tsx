"use client";

import { useState } from "react";
import { useApi } from "@/app/analytics/_components/useApi";

type Cell = { status: "reported"; minutes: number } | { status: "missed" } | { status: "none" };
type Data = { months: string[]; month: string; days: string[]; rows: { name: string; designation: string; cells: Cell[]; reported: number; missed: number }[] };

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) => ({ day: d.slice(8), weekday: new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }) });
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

export function MissedReports() {
  const [month, setMonth] = useState("");
  const { data, loading, error } = useApi<Data>(`/api/team-activity/missed${month ? `?month=${month}` : ""}`);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Missed reports</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            For each working day, the hours a person reported or a red ✕ where they sent nothing. A working day is a Monday to Saturday on which at least one person reported, so a day nobody reported (a holiday) isn&apos;t counted, and today is
            counted from tomorrow. Counting starts at a person&apos;s first report, and stops after their last once they have been quiet for 14 days. Leave isn&apos;t recorded, so check a ✕ against it.
          </p>
        </div>
        <select value={data?.month ?? month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          {(data?.months ?? []).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-status-fail-text">{error}</p>}
      {loading && !data ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : data && data.days.length === 0 ? (
        <p className="text-sm text-zinc-500">No working days to show for {monthLabel(data.month)} yet.</p>
      ) : (
        data && (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-primary-tint text-primary-tint-text">
                <tr>
                  <th className="sticky left-0 z-10 bg-primary-tint px-3 py-2 text-left font-medium">Who</th>
                  <th className="px-2 py-2 text-right font-medium">Missed</th>
                  <th className="px-2 py-2 text-right font-medium">Reported</th>
                  {data.days.map((d) => {
                    const l = dayLabel(d);
                    return (
                      <th key={d} className="px-2 py-2 text-center font-medium">
                        <div>{l.day}</div>
                        <div className="font-normal opacity-70">{l.weekday}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.name} className="border-t border-border-subtle">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">{r.name}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${r.missed > 0 ? "font-semibold text-status-fail-text" : "text-zinc-500"}`}>{r.missed}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{r.reported}</td>
                    {r.cells.map((c, i) => (
                      <td key={data.days[i]} className="px-2 py-1.5 text-center tabular-nums">
                        {c.status === "reported" ? <span className="text-zinc-700 dark:text-zinc-300">{hours(c.minutes)}</span> : c.status === "missed" ? <span className="font-semibold text-status-fail-text">✕</span> : <span className="text-zinc-300 dark:text-zinc-700">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
