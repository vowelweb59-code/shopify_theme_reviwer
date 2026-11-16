import Link from "next/link";
import { connectToDatabase } from "@/lib/db/connect";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { fmtUsd } from "@/lib/service/ui/format";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

export const dynamic = "force-dynamic";

// Owner, 2026-11-16: the Service section shows only the total projects and one table (hourly rate, weekly quote, Fixed/Hourly) for
// now; the rest is hidden and will be shown step by step. The former dashboard lives on in app/service/_dashboard/* (unused for now;
// restore it from git, commit before "Service: show only total projects", to bring it back).

type Row = {
  _id: string;
  name: string;
  clientId: string | null;
  status: string;
  reviewRating: number | null;
  contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null; weeklyLimitMinutes: number | null; fixedPriceCents: number | null } | null;
};

const hours = (minutes: number) => (minutes / 60).toLocaleString("en-IN", { maximumFractionDigits: 1 });

// Every contract made in the old app defaulted to HOURLY, so an hourly contract with no rate and no weekly quote has a type nobody
// chose (owner, 2026-11-16: "Aadhar Layouts" showed Hourly but was a $172 fixed project). It shows "Not set", only under All.
type Kind = "hourly" | "fixed" | "unset";
const kindOf = (p: Row): Kind =>
  p.contract?.type === "FIXED" ? "fixed" : p.contract && (p.contract.hourlyRateCents != null || p.contract.weeklyLimitMinutes != null) ? "hourly" : "unset";

// Owner, 2026-11-16: tabs instead of the total card; Timer (hourly contracts) opens by default, then Fixed, then All.
const TABS = [
  { id: "timer", label: "Timer projects", match: (p: Row) => kindOf(p) === "hourly" },
  { id: "fixed", label: "Fixed projects", match: (p: Row) => kindOf(p) === "fixed" },
  { id: "all", label: "All projects", match: () => true },
] as const;

// Owner, 2026-11-16: a second row by status, combined with the type tab above. Active = still running (incl. not started, blocked,
// waiting for the client); Closed = completed, cancelled or archived; On hold; All statuses = no filter. Active is the default.
const STATUS_TABS = [
  { id: "active", label: "Active projects", match: (p: Row) => ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT"].includes(p.status) },
  { id: "closed", label: "Projects closed", match: (p: Row) => ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(p.status) },
  { id: "on_hold", label: "Projects on hold", match: (p: Row) => p.status === "ON_HOLD" },
  { id: "all", label: "All statuses", match: () => true },
] as const;

const href = (tab: string, status: string) => {
  const q = new URLSearchParams();
  if (tab !== "timer") q.set("tab", tab);
  if (status !== "active") q.set("status", status);
  return q.size ? `/service?${q}` : "/service";
};

function Card({ to, active, label, count }: { to: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg border px-4 py-3 transition-colors ${active ? "border-primary bg-primary-tint" : "border-border-subtle bg-surface hover:bg-surface-muted"}`}
    >
      <div className={`text-sm ${active ? "font-medium text-primary-tint-text" : "text-zinc-500"}`}>{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{count.toLocaleString("en-IN")}</div>
    </Link>
  );
}

export default async function ServiceOverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const status = STATUS_TABS.find((s) => s.id === sp.status) ?? STATUS_TABS[0];
  await connectToDatabase();
  const all = await ServiceProject.find().select("name clientId status reviewRating contract").sort({ name: 1 }).lean<Row[]>();
  const ofType = all.filter(tab.match);
  const projects = ofType.filter(status.match);

  // Closed projects also show the closing review and what we took from the client (owner, 2026-11-16): hourly = reported hours x the
  // hourly rate, fixed = the fixed price. Reported hours (TIMER STATUS), not Upwork-verified billable hours.
  const showMoney = status.id === "closed";
  const minutes = new Map<string, number>();
  if (showMoney) {
    const att = await loadAttribution();
    const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
      .select("projectId clientId minutes allocations")
      .lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }> }>>();
    for (const e of expandAllocations(entries)) {
      const pid = projectOf(e, att.owner);
      if (pid) minutes.set(pid, (minutes.get(pid) ?? 0) + e.minutes);
    }
  }
  /** Cents taken from the client, or null when it cannot be worked out (no rate / no price entered). */
  const takenCents = (p: Row): number | null => {
    const c = p.contract;
    if (!c) return null;
    // A fixed project with a price: the price. A fixed project with only an hourly rate is invoiced by the hours worked (owner,
    // 2026-11-16: "we work on it, then raise an invoice at $15 an hour"): hours x rate, like an hourly one.
    if (c.type === "FIXED" && c.fixedPriceCents != null) return c.fixedPriceCents;
    return c.hourlyRateCents != null ? Math.round(((minutes.get(p._id) ?? 0) / 60) * c.hourlyRateCents) : null;
  };
  const totalTaken = showMoney ? projects.reduce((n, p) => n + (takenCents(p) ?? 0), 0) : 0;

  return (
    <div className="space-y-5">
      <nav aria-label="Project type" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Card key={t.id} to={href(t.id, status.id)} active={t.id === tab.id} label={t.label} count={all.filter((p) => t.match(p) && status.match(p)).length} />
        ))}
      </nav>
      <nav aria-label="Project status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <Card key={s.id} to={href(tab.id, s.id)} active={s.id === status.id} label={s.label} count={ofType.filter(s.match).length} />
        ))}
      </nav>

      {showMoney && (
        <p className="text-sm text-zinc-500">
          Taken from clients across these {projects.length.toLocaleString("en-IN")} projects: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fmtUsd(totalTaken)}</span>
          {" "}(hourly: reported hours × hourly rate; fixed: the fixed price; projects with no rate or price entered count as nothing).
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Project type</th>
              <th className="px-3 py-2 text-right font-medium">Hourly rate</th>
              <th className="px-3 py-2 text-right font-medium">Weekly quote</th>
              {showMoney && <th className="px-3 py-2 text-right font-medium">Closing review</th>}
              {showMoney && <th className="px-3 py-2 text-right font-medium">Taken from client</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {projects.map((p) => {
              const c = p.contract;
              return (
                <tr key={p._id}>
                  <td className="px-3 py-2">
                    <Link href={`/service/projects/${p._id}`} className="text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">{p.name}</Link>
                  </td>
                  <td className="px-3 py-2">
                    {!c ? (
                      <span className="text-zinc-400">No contract</span>
                    ) : kindOf(p) === "fixed" ? (
                      `Fixed${c.fixedPriceCents != null ? ` (${fmtUsd(c.fixedPriceCents)})` : ""}`
                    ) : kindOf(p) === "hourly" ? (
                      "Hourly"
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400" title="No rate or weekly quote entered: open the project to set Fixed or Hourly">Not set</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c?.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c?.weeklyLimitMinutes != null ? `${hours(c.weeklyLimitMinutes)} h/week` : "—"}</td>
                  {showMoney && (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.reviewRating != null ? <span title={`${p.reviewRating.toFixed(1)} out of 5`}><span className="text-status-warning-icon">★</span> {p.reviewRating.toFixed(1)}</span> : "—"}
                    </td>
                  )}
                  {showMoney && <td className="px-3 py-2 text-right tabular-nums">{takenCents(p) != null ? fmtUsd(takenCents(p)!) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
