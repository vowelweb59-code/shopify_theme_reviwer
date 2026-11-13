"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import type { DeadlineInfo } from "@/lib/projects/deadlines";
import { day, TimingLabel } from "./deadlineFormat";

type Row = DeadlineInfo & {
  deadline: string | null;
  startedOn: string | null;
  budgetDays: number | null;
  budgetSample: number | null;
  usedDays: number;
  extraDays: number | null;
  averageDeadline: string | null;
  deadlineBasis: "set" | "average" | null;
  lastReportOn: string | null;
};

const INPUT = "rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm";

/**
 * One project's deadline: the date (set by hand, else the average-based one), where it stands, the budget (average working days of
 * the finished projects of its type), the days used and the days extra. The same numbers as the Deadlines page.
 */
export function DeadlineCard({ projectId, projectType }: { projectId: string; projectType: "theme_development" | "preset_development" }) {
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");

  function load() {
    fetch(`/api/projects/${projectId}/deadline`)
      .then((r) => r.json())
      .then((d) => {
        if (d.project) {
          setRow(d.project);
          setDraft(d.project.deadline ?? "");
        } else setError(d.error ?? "Could not load the deadline.");
      })
      .catch(() => setError("Could not load the deadline."));
  }
  useEffect(load, [projectId]);

  async function save(value: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deadline: value }) });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save the deadline.");
      else load();
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const kind = projectType === "preset_development" ? "Preset Design & Development" : "Theme Design & Development";
  return (
    <Card>
      <CardHeader
        title="Deadline"
        description={`Due date and working days against the average of finished ${kind} projects. A date you set here replaces the average-based one.`}
      />
      {!row ? (
        <p className="text-sm text-zinc-500">{error ?? "Loading…"}</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-zinc-500">{row.state === "finished" ? "Last report" : "Due"}</div>
              <div className="text-base font-semibold tabular-nums">{row.date ? day(row.date) : "—"}</div>
              <div className="text-xs text-zinc-500">
                {row.state === "finished"
                  ? row.deadline || row.averageDeadline
                    ? `due ${day((row.deadline ?? row.averageDeadline) as string)}${row.deadline ? "" : " (average-based)"}`
                    : ""
                  : row.deadlineBasis === "average"
                    ? "average-based"
                    : row.deadlineBasis === "set"
                      ? "set by hand"
                      : ""}
              </div>
              <div className="mt-1">
                <TimingLabel r={row} />
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Working days</div>
              <div className="text-base font-semibold tabular-nums">
                {row.usedDays}
                {row.budgetDays !== null && <span className="font-normal text-zinc-500"> of {row.budgetDays} d</span>}
              </div>
              <div className="text-xs text-zinc-500">
                {row.budgetDays !== null ? `average of ${row.budgetSample} finished project${row.budgetSample === 1 ? "" : "s"}` : "no finished project has hours yet, so no average"}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Extra days</div>
              {row.extraDays === null ? (
                <div className="text-base font-semibold text-zinc-400">—</div>
              ) : row.extraDays > 0 ? (
                <div className="text-base font-semibold text-status-fail-text">{row.extraDays} days extra</div>
              ) : (
                <div className="text-base font-semibold text-status-pass-text">None</div>
              )}
              <div className="text-xs text-zinc-500">{row.startedOn ? `started ${day(row.startedOn)}` : "no report yet"}</div>
            </div>
          </div>
          {row.state !== "finished" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-zinc-700 dark:text-zinc-300">Set the deadline</span>
                <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} className={INPUT} />
              </label>
              <Button size="sm" variant="secondary" onClick={() => save(draft)} loading={saving} disabled={draft === (row.deadline ?? "")}>
                Save date
              </Button>
              {row.deadline && (
                <Button size="sm" variant="secondary" onClick={() => save("")} disabled={saving}>
                  Use the average instead
                </Button>
              )}
            </div>
          )}
          {error && <p className="text-xs text-status-fail-text">{error}</p>}
        </div>
      )}
    </Card>
  );
}
