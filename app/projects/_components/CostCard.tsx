"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/_components/ui/Card";

type Person = { memberId: string; name: string; designation: string; hours: number; cost: number | null };
type Cost = { cost: number; hours: number; unpricedHours: number; lines: { build: number; presets: number; updates: number; total: number }; people: Person[] };

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const LINE_LABELS = { build: "Theme build", presets: "Presets", updates: "Updates" } as const;

/**
 * What this project cost: the hours reported on it, priced at each reporter's hourly cost (monthly salary / 221 h), by kind of work and
 * by person. The same number as the Cost column on the Projects list; the theme's whole cost is on the Theme Cost page.
 */
export function CostCard({ projectId }: { projectId: string }) {
  const [state, setState] = useState<{ cost: Cost | null; hoursPerMonth: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/cost`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setState({ cost: d.cost, hoursPerMonth: d.hoursPerMonth })))
      .catch(() => setError("Could not load the cost."));
  }, [projectId]);

  const cost = state?.cost ?? null;
  return (
    <Card>
      <CardHeader
        title="Cost"
        description={`Hours reported on this project, each priced at the reporter's hourly cost (monthly salary / ${state?.hoursPerMonth ?? 221} h). Product Managers are included at their own rate. Salaries are set on the Team page.`}
      />
      {error ? (
        <p className="text-sm text-status-fail-text">{error}</p>
      ) : !state ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !cost ? (
        <p className="text-sm text-zinc-500">Nobody has reported hours on this project yet.</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <div className="text-xs text-zinc-500">Total cost</div>
              <div className="text-xl font-semibold tabular-nums">
                {INR.format(cost.cost)}
                {cost.unpricedHours > 0 ? "*" : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Hours reported</div>
              <div className="text-xl font-semibold tabular-nums">{cost.hours} h</div>
            </div>
            {(Object.keys(LINE_LABELS) as (keyof typeof LINE_LABELS)[])
              .filter((k) => cost.lines[k] > 0)
              .map((k) => (
                <div key={k}>
                  <div className="text-xs text-zinc-500">{LINE_LABELS[k]}</div>
                  <div className="text-base font-semibold tabular-nums">{INR.format(cost.lines[k])}</div>
                </div>
              ))}
          </div>
          {cost.unpricedHours > 0 && (
            <p className="text-xs text-status-warning-text">
              * {cost.unpricedHours} h belong to people with no salary entered, so they are counted in the hours but not priced; the real cost is higher. Add the salaries on the{" "}
              <Link href="/team" className="underline">
                Team
              </Link>{" "}
              page.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1 pr-3 font-medium">Person</th>
                  <th className="py-1 pr-3 font-medium">Hours</th>
                  <th className="py-1 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {cost.people.map((p) => (
                  <tr key={p.memberId} className="border-t border-border-subtle">
                    <td className="py-2 pr-3">
                      {p.name} <span className="text-xs text-zinc-500">{p.designation}</span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{p.hours}</td>
                    <td className="py-2 tabular-nums">{p.cost === null ? <span className="text-status-warning-text">no salary</span> : INR.format(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
