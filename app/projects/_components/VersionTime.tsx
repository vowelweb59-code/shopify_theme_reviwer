"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { formatDateOnly } from "@/app/_components/formatDate";

type NoteGroup = { heading: string; items: string[] };
type Report = { date: string; name: string; hours: number; note: string };
type Row = {
  version: string;
  releasedOn: string | null;
  since: string | null;
  calendarDays: number | null;
  daysWorked: number;
  hours: number;
  effortDays: number;
  people: { name: string; hours: number; days: number }[];
  summary: string | null;
  notes: NoteGroup[];
  reports: Report[];
  inProgress: boolean;
};
type Result = { rows: Row[]; undated: string[]; refreshedAt: string | null; entryCount: number; firstEntryOn: string | null; error: string | null };

const ITEM_LIMIT = 6;
const REPORT_LIMIT = 6;

// "No security updates in this release." and the like are filler, not something the version changed.
const isFiller = (item: string) => /^no\b.*\b(in this release|this release)\.?$/i.test(item.trim());

function shortMemo(memo: string): string {
  // Reports often start with their own label ("Theme Update - ", "Preset Development: "); the label adds nothing here.
  const text = memo.replace(/^\s*(theme|preset)\s+(update|updates|development|design|support)\s*[-–—:]\s*/i, "");
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

/** What one version shipped: the Theme Store's release note on the left, our developers' own reports on the right. */
function VersionDetails({ row }: { row: Row }) {
  const [allItems, setAllItems] = useState(false);
  const [allReports, setAllReports] = useState(false);
  const groups = row.notes.map((g) => ({ ...g, items: g.items.filter((i) => !isFiller(i)) })).filter((g) => g.items.length > 0);
  const hasNotes = Boolean(row.summary) || groups.length > 0;
  const reports = allReports ? row.reports : row.reports.slice(0, REPORT_LIMIT);
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  // Without "Show all", only the first ITEM_LIMIT bullets across the groups are shown.
  const visibleGroups = groups
    .map((g, gi) => {
      const before = groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0);
      const room = allItems ? g.items.length : Math.max(0, ITEM_LIMIT - before);
      return { ...g, items: g.items.slice(0, room) };
    })
    .filter((g) => g.items.length > 0);

  return (
    <div className={`grid gap-4 ${row.inProgress ? "" : "md:grid-cols-2"}`}>
      {!row.inProgress && (
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">In the release notes</h4>
          {!hasNotes ? (
            <p className="text-sm text-zinc-400">The Theme Store has no notes for this version.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {row.summary && <p className="text-zinc-700 dark:text-zinc-300">{row.summary}</p>}
              {visibleGroups.map((g) => (
                <div key={g.heading}>
                  {g.heading && <div className="mb-1 text-xs font-medium text-zinc-500">{g.heading}</div>}
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
                    {g.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {!allItems && totalItems > ITEM_LIMIT && (
                <button type="button" onClick={() => setAllItems(true)} className="w-fit text-xs text-primary underline underline-offset-2">
                  Show all changes
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{row.inProgress ? "Reported so far" : "Reported by our developers"}</h4>
        {row.reports.length === 0 ? (
          <p className="text-sm text-zinc-400">No reports with a description in this period.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {reports.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-l-2 border-border-subtle pl-3">
                <span className="text-xs text-zinc-500">
                  {formatDateOnly(r.date)} · {r.name} · {r.hours} h
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">{shortMemo(r.note)}</span>
              </li>
            ))}
            {!allReports && row.reports.length > REPORT_LIMIT && (
              <li>
                <button type="button" onClick={() => setAllReports(true)} className="text-xs text-primary underline underline-offset-2">
                  Show all {row.reports.length} reports
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Time spent per Theme Store version on a Theme Update project. A release's window runs from the previous release's date to its own
 * release day; the days the developers logged in that window are that version's time. Each row opens to show what the version
 * shipped: the Theme Store's release note and the developers' own reports for the same period.
 */
export function VersionTime({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/version-time`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body) setFailed(true);
        else {
          setData(body as Result);
          // The newest row starts open so the page opens on what was shipped last.
          const first = (body as Result).rows[0];
          if (first) setOpen(new Set([first.version]));
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function toggle(version: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader
        title="Time and updates per version"
        description="Each Theme Store release covers the days after the previous release up to its own release day. Open a version to see what it shipped, from the release notes and from our developers' reports."
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
                  <th className="w-6 py-1.5" />
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
                  const isOpen = open.has(r.version);
                  return (
                    <Fragment key={r.version}>
                      <tr className="cursor-pointer border-t border-border-subtle align-top hover:bg-surface-muted/60" onClick={() => toggle(r.version)}>
                        <td className="py-2 pl-1">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Hide" : "Show"} what ${r.version} shipped`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(r.version);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                          >
                            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden />
                          </button>
                        </td>
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
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={7} className="pb-4 pr-2 pt-1">
                            <div className="rounded-lg border border-border-subtle bg-surface-muted/40 p-4">
                              <VersionDetails row={r} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
            {data.refreshedAt ? `; release dates and notes read from the Theme Store on ${formatDateOnly(data.refreshedAt)}` : ""}.
            {data.firstEntryOn ? ` Reports start on ${formatDateOnly(data.firstEntryOn)}; earlier releases show "—".` : ""} Work logged before the first listed release is counted in it.
          </p>
        </div>
      )}
    </Card>
  );
}
