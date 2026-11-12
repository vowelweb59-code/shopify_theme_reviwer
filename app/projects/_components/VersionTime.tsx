"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { formatDateOnly } from "@/app/_components/formatDate";

type Row = {
  version: string;
  releasedOn: string | null;
  since: string | null;
  calendarDays: number | null;
  daysWorked: number;
  hours: number;
  effortDays: number;
  people: { name: string; hours: number; days: number }[];
  inProgress: boolean;
};
type Result = { rows: Row[]; undated: string[]; refreshedAt: string | null; entryCount: number; firstEntryOn: string | null; error: string | null };

/**
 * Time spent per Theme Store version on a Theme Update project. A release's window runs from the previous release's date to its own
 * release day; the days the developers logged in that window (their reports, in the project's hours log) are that version's time.
 */
export function VersionTime({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/version-time`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body) setFailed(true);
        else setData(body as Result);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Card>
      <CardHeader
        title="Time per version"
        description="Each Theme Store release is the days after the previous release up to its own release day. The days our developers reported in that window are the time spent on that version."
      />
      {failed ? (
        <p className="text-sm text-status-fail-text">Couldn&apos;t load the versions. Try again in a moment.</p>
      ) : !data ? (
        <p className="text-sm text-zinc-500">Reading the Theme Store release notes…</p>
      ) : data.rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{data.error ?? "The Theme Store lists no dated release for this theme yet."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="py-1.5 pr-3 font-medium">Version</th>
                  <th className="py-1.5 pr-3 font-medium">Released</th>
                  <th className="py-1.5 pr-3 text-right font-medium" title="Days between the previous release and this one">Days between</th>
                  <th className="py-1.5 pr-3 text-right font-medium" title="Days on which a developer logged time">Days worked</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Hours</th>
                  <th className="py-1.5 pr-3 text-right font-medium" title="Hours as working days at 8.5 h per day">Effort (days)</th>
                  <th className="py-1.5 font-medium">Who</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  // Released before anything was logged in the project: no reports to count, not "no work".
                  const noLog = r.releasedOn !== null && data.firstEntryOn !== null && r.releasedOn < data.firstEntryOn;
                  return (
                  <tr key={r.version} className="border-t border-border-subtle align-top">
                    <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {r.inProgress ? (
                        <span className="inline-flex items-center gap-1.5">
                          {r.version}
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">in progress</span>
                        </span>
                      ) : (
                        r.version
                      )}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{r.releasedOn ? formatDateOnly(r.releasedOn) : r.since ? `after ${formatDateOnly(r.since)}` : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.calendarDays ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{noLog ? <span className="font-normal text-zinc-400">—</span> : r.daysWorked}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{noLog ? <span className="text-zinc-400">—</span> : r.hours}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{noLog ? <span className="text-zinc-400">—</span> : r.effortDays}</td>
                    <td className="py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {noLog ? (
                        <span className="text-zinc-400">Before the first logged report</span>
                      ) : r.people.length === 0 ? (
                        <span className="text-zinc-400">No reports</span>
                      ) : (
                        r.people.map((p) => `${p.name} (${p.days} d, ${p.hours} h)`).join(", ")
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.undated.length > 0 && (
            <p className="text-xs text-zinc-500">
              The Theme Store shows no release date for {data.undated.join(", ")}, so {data.undated.length === 1 ? "its" : "their"} work is counted in the next dated release.
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Based on {data.entryCount} logged entr{data.entryCount === 1 ? "y" : "ies"} in this project&apos;s hours log
            {data.refreshedAt ? `; release dates read from the Theme Store on ${formatDateOnly(data.refreshedAt)}` : ""}. {data.firstEntryOn ? ` Reports start on ${formatDateOnly(data.firstEntryOn)}; earlier releases show "—".` : ""} Work logged before the first listed release is counted in it.
          </p>
        </div>
      )}
    </Card>
  );
}
