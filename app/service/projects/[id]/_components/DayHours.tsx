"use client";

import { useState } from "react";
import { Avatar } from "./OverviewParts";
import { fmtMinutes } from "@/lib/service/ui/format";

export type DayPerson = { name: string; minutes: number; star: string };
export type DayHoursDay = { date: string; minutes: number; people: DayPerson[] };

const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Hours per day as bars (owner, 2026-11-23: "when I click the bar of that day it should show whose hours those are and who worked how
 * much"). Clicking a bar selects that day and the list below switches from the period's totals to that day's people; clicking it again
 * (or "Show the whole period") goes back.
 */
export function DayHours({ days, month, totals }: { days: DayHoursDay[]; month: boolean; totals: DayPerson[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const day = days.find((d) => d.date === picked) ?? null;
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const label = (d: { date: string }, i: number) => {
    const dt = new Date(`${d.date}T00:00:00Z`);
    if (!month) return dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return i % 5 === 0 ? String(dt.getUTCDate()) : "";
  };
  const shown = day ? day.people : totals;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex h-24 items-end gap-1" role="group" aria-label="Hours per day: choose a day to see who worked">
          {days.map((d) => {
            const on = d.date === picked;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setPicked(on ? null : d.date)}
                aria-pressed={on}
                aria-label={`${longDay(d.date)}: ${fmtMinutes(d.minutes)}`}
                title={`${longDay(d.date)}: ${fmtMinutes(d.minutes)}`}
                className={`group flex h-full min-w-0 flex-1 items-end rounded-t-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${picked && !on ? "opacity-40" : ""}`}
              >
                <span
                  className={`w-full rounded-t-[4px] transition-colors ${d.minutes > 0 ? (on ? "bg-primary ring-2 ring-primary/40" : "bg-primary group-hover:bg-primary/80") : "bg-surface-muted"}`}
                  style={{ height: `${d.minutes > 0 ? Math.max(4, (d.minutes / max) * 100) : 3}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1 text-[11px] text-zinc-500">
          {days.map((d, i) => (
            <div key={d.date} className={`min-w-0 flex-1 text-center ${d.date === picked ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}`}>
              {label(d, i)}
            </div>
          ))}
        </div>
      </div>

      {day && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium">
            {longDay(day.date)} <span className="font-normal text-zinc-500">· {fmtMinutes(day.minutes)} in all</span>
          </p>
          <button type="button" onClick={() => setPicked(null)} className="text-primary hover:underline">
            Show the whole period
          </button>
        </div>
      )}
      {shown.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <li key={p.name} className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-muted/40 py-1 pl-1 pr-3 text-sm">
              <Avatar name={p.name} />
              {p.star}
              {p.name}
              <span className="tabular-nums text-zinc-500">{fmtMinutes(p.minutes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        day && <p className="text-sm text-zinc-500">No hours were reported on this day.</p>
      )}
    </div>
  );
}
