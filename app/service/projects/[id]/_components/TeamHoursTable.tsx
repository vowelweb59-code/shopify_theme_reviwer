import { fmtLongDay, fmtMinutes } from "@/lib/service/ui/format";
import type { TeamHoursRow } from "@/lib/service/api/hours";

// Who worked how much on a project, in one table (owner, 2026-11-20: the two separate tables were hard to read): a summary strip, then one
// row per person with the chosen period, the last 30 days, the newest months, the total with its share, and the last report under the
// name. Small bars show each figure against the largest in its column group.
const MONTHS_SHOWN = 6;
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

function Bar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="ml-auto mt-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
      <div className={`h-full ${tone}`} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function Cell({ minutes, max, strong = false }: { minutes: number; max: number; strong?: boolean }) {
  if (!minutes) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  return (
    <>
      <div className={strong ? "font-medium" : undefined}>{fmtMinutes(minutes)}</div>
      <Bar value={minutes} max={max} />
    </>
  );
}

export function TeamHoursTable({
  rows,
  months,
  periodText,
  unit,
  starred,
  compact = false,
}: {
  rows: TeamHoursRow[];
  months: string[];
  periodText: string;
  unit: "week" | "month";
  starred: (name: string) => string;
  compact?: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No reports on this project yet.</p>;
  const shown = [...months].reverse().slice(0, MONTHS_SHOWN);
  const older = [...months].reverse().slice(MONTHS_SHOWN);
  const monthsTotal = (r: TeamHoursRow, list: string[]) => list.reduce((n, m) => n + (r.byMonth[m] ?? 0), 0);
  const hasLater = rows.some((r) => r.later > 0);
  const hasOlder = older.length > 0;
  const grand = rows.reduce((n, r) => n + r.total, 0);
  const sum = (f: (r: TeamHoursRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const colMax = (f: (r: TeamHoursRow) => number) => Math.max(0, ...rows.map(f));
  const periodMax = colMax((r) => r.week);
  const last30Max = colMax((r) => r.last30);
  const monthMax = Math.max(0, ...rows.flatMap((r) => shown.map((m) => r.byMonth[m] ?? 0)), ...rows.map((r) => monthsTotal(r, older)));
  const totalMax = colMax((r) => r.total);
  const th = "whitespace-nowrap px-3 py-2 text-right font-medium";
  const td = "px-3 py-2 text-right tabular-nums align-top";

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total reported", value: fmtMinutes(grand) },
            { label: `This ${unit} · ${periodText}`, value: fmtMinutes(sum((r) => r.week)) },
            { label: "Last 30 days", value: fmtMinutes(sum((r) => r.last30)) },
            { label: "People who worked", value: String(rows.length) },
          ].map((x) => (
            <div key={x.label} className="rounded-md border border-border-subtle bg-surface-muted/50 px-3 py-2">
              <div className="text-xs text-zinc-500">{x.label}</div>
              <div className="text-lg font-semibold tabular-nums">{x.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="sticky left-0 bg-surface-muted px-3 py-2 text-left font-medium">Person</th>
              <th className={`${th} bg-primary-tint/40 text-primary-tint-text`} title={periodText}>
                This {unit}
              </th>
              <th className={th}>Last 30 days</th>
              {shown.map((m) => (
                <th key={m} className={th}>
                  {monthName(m)}
                </th>
              ))}
              {hasOlder && (
                <th className={th} title={`${older.length} earlier months`}>
                  Earlier
                </th>
              )}
              {hasLater && (
                <th className={th} title="Dated in a future month: a typing error in the report">
                  Future date
                </th>
              )}
              <th className={th}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((r) => (
              <tr key={r.name} className="hover:bg-surface-muted/40">
                <td className="sticky left-0 bg-surface px-3 py-2 align-top">
                  <div className="whitespace-nowrap font-medium">
                    {starred(r.name)}
                    {r.name}
                  </div>
                  <div className="text-xs text-zinc-500">last report {fmtLongDay(r.lastReport)}</div>
                </td>
                <td className={`${td} bg-primary-tint/20`}>
                  <Cell minutes={r.week} max={periodMax} strong />
                </td>
                <td className={td}>
                  <Cell minutes={r.last30} max={last30Max} />
                </td>
                {shown.map((m) => (
                  <td key={m} className={td}>
                    <Cell minutes={r.byMonth[m] ?? 0} max={monthMax} />
                  </td>
                ))}
                {hasOlder && (
                  <td className={td}>
                    <Cell minutes={monthsTotal(r, older)} max={monthMax} />
                  </td>
                )}
                {hasLater && (
                  <td className={td}>
                    <Cell minutes={r.later} max={monthMax} />
                  </td>
                )}
                <td className={td}>
                  <div className="font-semibold">{fmtMinutes(r.total)}</div>
                  <div className="text-xs text-zinc-500">{grand ? Math.round((r.total / grand) * 100) : 0}%</div>
                  <Bar value={r.total} max={totalMax} tone="bg-status-pass-icon" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border-subtle bg-surface-muted/60 font-medium">
            <tr>
              <td className="sticky left-0 bg-surface-muted/60 px-3 py-2">All people</td>
              <td className={`${td} bg-primary-tint/20`}>{fmtMinutes(sum((r) => r.week))}</td>
              <td className={td}>{fmtMinutes(sum((r) => r.last30))}</td>
              {shown.map((m) => (
                <td key={m} className={td}>
                  {fmtMinutes(sum((r) => r.byMonth[m] ?? 0))}
                </td>
              ))}
              {hasOlder && <td className={td}>{fmtMinutes(sum((r) => monthsTotal(r, older)))}</td>}
              {hasLater && <td className={td}>{fmtMinutes(sum((r) => r.later))}</td>}
              <td className={td}>{fmtMinutes(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
